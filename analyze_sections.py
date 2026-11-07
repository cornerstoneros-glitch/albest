from bs4 import BeautifulSoup

def main():
    file_path = r'C:\Users\hecki\.gemini\antigravity-ide\brain\1d94abc9-a800-4798-b12f-71aff9e36ee7\.system_generated\steps\363\content.md'
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    for s in soup.find_all(['section', 'header', 'footer', 'nav']):
        cls = s.get('class', [''])
        title = ''
        if s.h2:
            title = s.h2.text
        elif s.h1:
            title = s.h1.text
        print(f"{s.name}.{'.'.join(cls)} - {title}")

if __name__ == '__main__':
    main()
