const { PrismaClient } = require('@prisma/client');
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL || 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('Connexion à la base de données en cours...');
    
    // Paramètres de l'administrateur par défaut
    const email = process.env.ADMIN_EMAIL || 'admin@albest.io';
    const password = process.env.ADMIN_PASSWORD || 'AdminAlbest2026!';
    const name = 'Administrateur Albest';
    const company = 'Albest';
    const phone = '01 23 45 67 89';

    const existingUser = await prisma.user.findUnique({
        where: { email }
    });

    if (existingUser) {
        console.log(`L'utilisateur ${email} existe déjà (Rôle: ${existingUser.role}).`);
        if (existingUser.role !== 'ADMIN') {
            await prisma.user.update({
                where: { email },
                data: { role: 'ADMIN' }
            });
            console.log(`Rôle mis à jour en ADMIN pour ${email}.`);
        }
    } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                company,
                phone,
                role: 'ADMIN'
            }
        });
        console.log(`Compte administrateur créé avec succès !`);
        console.log(`ID: ${newUser.id} | Email: ${newUser.email} | Rôle: ${newUser.role}`);
        console.log(`Mot de passe initial: ${password}`);
    }

    const totalUsers = await prisma.user.count();
    console.log(`Total d'utilisateurs dans la base: ${totalUsers}`);
}

main()
    .catch((e) => {
        console.error('Erreur lors de la création de l\'administrateur:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

