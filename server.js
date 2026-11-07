const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SqliteStore = require('better-sqlite3-session-store')(session);
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');

const app = express();
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const PORT = process.env.PORT || 3000;

// ===================== MIDDLEWARE =====================
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const sessionsDB = new Database('./sessions.db');
app.use(session({
    store: new SqliteStore({
      client: sessionsDB,
      expired: { clear: true, intervalMs: 900000 }
    }),
    secret: process.env.SESSION_SECRET || 'albest_secret_2026',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));
app.use(express.static(path.join(__dirname)));

// ===================== GUARDS =====================
function requireAuth(req, res, next) {
    if (req.session && req.session.userId) return next();
    return res.status(401).json({ error: 'Non authentifié' });
}
function requireAdmin(req, res, next) {
    if (req.session && req.session.role === 'ADMIN') return next();
    return res.status(403).json({ error: 'Accès refusé' });
}

// ===================== AUTH =====================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name, company, phone } = req.body;
        if (!email || !password || !name) return res.status(400).json({ error: 'Champs requis manquants' });
        const exists = await prisma.user.findUnique({ where: { email } });
        if (exists) return res.status(409).json({ error: 'Email déjà utilisé' });
        const hashed = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({ data: { email, password: hashed, name, company, phone } });
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.name = user.name;
        res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ error: 'Identifiants invalides' });
        req.session.userId = user.id;
        req.session.role = user.role;
        req.session.name = user.name;
        res.json({ success: true, user: { id: user.id, name: user.name, role: user.role } });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.post('/api/auth/logout', (req, res) => { req.session.destroy(); res.json({ success: true }); });
app.get('/api/auth/me', (req, res) => {
    if (req.session.userId) res.json({ loggedIn: true, userId: req.session.userId, name: req.session.name, role: req.session.role });
    else res.json({ loggedIn: false });
});

// ===================== CLIENT API =====================
app.get('/api/client/overview', requireAuth, async (req, res) => {
    try {
        const [quotes, orders] = await Promise.all([
            prisma.quote.findMany({ where: { userId: req.session.userId }, orderBy: { createdAt: 'desc' }, take: 10 }),
            prisma.order.findMany({ where: { userId: req.session.userId }, orderBy: { createdAt: 'desc' }, take: 10 })
        ]);
        res.json({ quotes, orders });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.post('/api/client/bat/approve', requireAuth, async (req, res) => {
    try {
        const { quoteId, approve } = req.body;
        const quote = await prisma.quote.findFirst({ where: { id: parseInt(quoteId), userId: req.session.userId } });
        if (!quote) return res.status(404).json({ error: 'Devis introuvable' });
        await prisma.quote.update({ where: { id: parseInt(quoteId) }, data: { batStatus: approve ? 'VALIDE' : 'REJETE', status: approve ? 'EN_PRODUCTION' : 'EN_ATTENTE' } });
        res.json({ success: true });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// ===================== ADMIN API =====================
app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
        const [totalQuotes, pendingQuotes, activeOrders, totalMessages, totalUsers, totalContacts, pendingTasks, recentQuotes, dealsTotal] = await Promise.all([
            prisma.quote.count(),
            prisma.quote.count({ where: { status: 'EN_ATTENTE' } }),
            prisma.order.count({ where: { status: { not: 'LIVRE' } } }),
            prisma.contactMessage.count({ where: { status: 'NOUVEAU' } }),
            prisma.user.count({ where: { role: 'CLIENT' } }),
            prisma.crmContact.count(),
            prisma.crmTask.count({ where: { status: { not: 'TERMINEE' } } }),
            prisma.quote.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { user: { select: { name: true, email: true } } } }),
            prisma.crmDeal.aggregate({ _sum: { amount: true }, where: { stage: 'GAGNE' } })
        ]);
        res.json({ totalQuotes, pendingQuotes, activeOrders, totalMessages, totalUsers, totalContacts, pendingTasks, recentQuotes, revenueWon: dealsTotal._sum.amount || 0 });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/devis', requireAdmin, async (req, res) => {
    try {
        const devis = await prisma.quote.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } });
        res.json(devis);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/admin/devis/:id', requireAdmin, async (req, res) => {
    try {
        const { status, amount, batImage } = req.body;
        const updated = await prisma.quote.update({ where: { id: parseInt(req.params.id) }, data: { status, amount: amount ? parseFloat(amount) : undefined, batImage, batStatus: batImage ? 'EN_ATTENTE' : undefined } });
        res.json(updated);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({ orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, email: true } } } });
        res.json(orders);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await prisma.order.update({ where: { id: parseInt(req.params.id) }, data: { status: req.body.status } });
        res.json(updated);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/messages', requireAdmin, async (req, res) => {
    try {
        const messages = await prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(messages);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/admin/messages/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await prisma.contactMessage.update({ where: { id: parseInt(req.params.id) }, data: { status: 'TRAITE' } });
        res.json(updated);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/products', requireAdmin, async (req, res) => {
    try { res.json(await prisma.product.findMany({ orderBy: { createdAt: 'desc' } })); }
    catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.post('/api/admin/products', requireAdmin, async (req, res) => {
    try {
        const { name, category, description, price, stock } = req.body;
        const product = await prisma.product.create({ data: { name, category, description, price: parseFloat(price), stock: parseInt(stock) } });
        res.json(product);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try { await prisma.product.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await prisma.user.findMany({ where: { role: 'CLIENT' }, orderBy: { createdAt: 'desc' }, select: { id: true, name: true, email: true, company: true, phone: true, createdAt: true } });
        res.json(users);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// ===================== CRM 360 API =====================
// Contacts
app.get('/api/crm/contacts', requireAdmin, async (req, res) => {
    try {
        const { search, stage } = req.query;
        const where = {};
        if (stage) where.stage = stage;
        if (search) where.OR = [{ firstName: { contains: search } }, { lastName: { contains: search } }, { company: { contains: search } }, { email: { contains: search } }];
        const contacts = await prisma.crmContact.findMany({ where, orderBy: { updatedAt: 'desc' }, include: { _count: { select: { interactions: true, deals: true, tasks: true } } } });
        res.json(contacts);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.get('/api/crm/contacts/:id', requireAdmin, async (req, res) => {
    try {
        const contact = await prisma.crmContact.findUnique({
            where: { id: parseInt(req.params.id) },
            include: { interactions: { orderBy: { createdAt: 'desc' } }, deals: { orderBy: { createdAt: 'desc' } }, tasks: { orderBy: { dueDate: 'asc' } }, notes_list: { orderBy: { createdAt: 'desc' } } }
        });
        if (!contact) return res.status(404).json({ error: 'Contact introuvable' });
        res.json(contact);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.post('/api/crm/contacts', requireAdmin, async (req, res) => {
    try {
        const contact = await prisma.crmContact.create({ data: { ...req.body, lastContact: new Date() } });
        res.json(contact);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/crm/contacts/:id', requireAdmin, async (req, res) => {
    try {
        const contact = await prisma.crmContact.update({ where: { id: parseInt(req.params.id) }, data: { ...req.body, updatedAt: new Date() } });
        res.json(contact);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.delete('/api/crm/contacts/:id', requireAdmin, async (req, res) => {
    try { await prisma.crmContact.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// Interactions
app.post('/api/crm/interactions', requireAdmin, async (req, res) => {
    try {
        const { contactId, type, subject, content, direction } = req.body;
        const interaction = await prisma.crmInteraction.create({ data: { contactId: parseInt(contactId), type, subject, content, direction } });
        await prisma.crmContact.update({ where: { id: parseInt(contactId) }, data: { lastContact: new Date() } });
        res.json(interaction);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// Deals / Pipeline
app.get('/api/crm/deals', requireAdmin, async (req, res) => {
    try {
        const deals = await prisma.crmDeal.findMany({ orderBy: { createdAt: 'desc' }, include: { contact: { select: { firstName: true, lastName: true, company: true } } } });
        res.json(deals);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.post('/api/crm/deals', requireAdmin, async (req, res) => {
    try {
        const { contactId, title, amount, probability, stage, dueDate } = req.body;
        const deal = await prisma.crmDeal.create({ data: { contactId: parseInt(contactId), title, amount: parseFloat(amount), probability: parseInt(probability), stage, dueDate: dueDate ? new Date(dueDate) : null } });
        res.json(deal);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/crm/deals/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await prisma.crmDeal.update({ where: { id: parseInt(req.params.id) }, data: { ...req.body, updatedAt: new Date() } });
        res.json(updated);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.delete('/api/crm/deals/:id', requireAdmin, async (req, res) => {
    try { await prisma.crmDeal.delete({ where: { id: parseInt(req.params.id) } }); res.json({ success: true }); }
    catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// Tasks
app.get('/api/crm/tasks', requireAdmin, async (req, res) => {
    try {
        const tasks = await prisma.crmTask.findMany({ where: { status: { not: 'TERMINEE' } }, orderBy: { dueDate: 'asc' }, include: { contact: { select: { firstName: true, lastName: true } } } });
        res.json(tasks);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.post('/api/crm/tasks', requireAdmin, async (req, res) => {
    try {
        const { contactId, title, description, priority, dueDate, assignedTo } = req.body;
        const task = await prisma.crmTask.create({ data: { contactId: contactId ? parseInt(contactId) : null, title, description, priority, dueDate: dueDate ? new Date(dueDate) : null, assignedTo } });
        res.json(task);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});
app.put('/api/crm/tasks/:id', requireAdmin, async (req, res) => {
    try {
        const updated = await prisma.crmTask.update({ where: { id: parseInt(req.params.id) }, data: req.body });
        res.json(updated);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// Notes
app.post('/api/crm/notes', requireAdmin, async (req, res) => {
    try {
        const { contactId, content } = req.body;
        const note = await prisma.crmNote.create({ data: { contactId: contactId ? parseInt(contactId) : null, userId: req.session.userId, content } });
        res.json(note);
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// CRM Stats
app.get('/api/crm/stats', requireAdmin, async (req, res) => {
    try {
        const [byStage, wonDeals, totalPipeline, openTasks] = await Promise.all([
            prisma.crmContact.groupBy({ by: ['stage'], _count: { id: true } }),
            prisma.crmDeal.aggregate({ _sum: { amount: true }, where: { stage: 'GAGNE' } }),
            prisma.crmDeal.aggregate({ _sum: { amount: true }, where: { stage: { notIn: ['GAGNE', 'PERDU'] } } }),
            prisma.crmTask.count({ where: { status: { not: 'TERMINEE' } } })
        ]);
        res.json({ byStage, wonRevenue: wonDeals._sum.amount || 0, pipelineValue: totalPipeline._sum.amount || 0, openTasks });
    } catch (err) { require('fs').appendFileSync('debug.log', String(err) + '\n' + err.stack + '\n'); res.status(500).json({ error: String(err) }); }
});

// ===================== CONTACT FORM =====================
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) return res.status(400).json({ error: 'Tous les champs sont requis.' });
        const newMessage = await prisma.contactMessage.create({ data: { name, email, message } });
        res.status(201).json({ success: true, data: newMessage });
    } catch (error) { console.error("Erreur Prisma:", error); res.status(500).json({ error: 'Erreur lors de l\'enregistrement.' }); }
});

// ===================== PAGES =====================
const fs = require('fs');
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'login.html')));
app.get('/dashboard-client', (req, res) => res.sendFile(path.join(__dirname, 'dashboard-client.html')));
app.get('/dashboard-admin', (req, res) => res.sendFile(path.join(__dirname, 'dashboard-admin.html')));
app.get('/crm', (req, res) => res.sendFile(path.join(__dirname, 'crm.html')));

app.get('/services/:slug', (req, res) => {
    const p = path.join(__dirname, 'services', `${req.params.slug}.html`);
    if (fs.existsSync(p)) res.sendFile(p); else res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/contact', (req, res) => res.sendFile(path.join(__dirname, 'contact.html')));
app.get('/devis', (req, res) => res.sendFile(path.join(__dirname, 'devis.html')));
app.get('/mentions', (req, res) => res.sendFile(path.join(__dirname, 'mentions.html')));
app.get('/cgv', (req, res) => res.sendFile(path.join(__dirname, 'cgv.html')));
app.get('/confidentialite', (req, res) => res.sendFile(path.join(__dirname, 'confidentialite.html')));
app.get('/categorie/:slug', (req, res) => {
    const g = path.join(__dirname, 'generated', `${req.params.slug}.html`);
    if (fs.existsSync(g)) res.sendFile(g); else res.sendFile(path.join(__dirname, 'category.html'));
});
app.use((req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, () => console.log(`Serveur démarré sur http://localhost:${PORT}`));
