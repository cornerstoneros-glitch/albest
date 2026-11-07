from bs4 import BeautifulSoup

def main():
    file_path = r'C:\Users\hecki\.gemini\antigravity-ide\brain\1d94abc9-a800-4798-b12f-71aff9e36ee7\.system_generated\steps\370\content.md'
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    nav = soup.find('nav', class_='navbar')
    if nav:
        links = nav.find_all('a')
        for a in links:
            print(f"Link: {a.text.strip()} -> {a.get('href')}")
        
        print("\n\nDropdown contents if any:")
        print(nav.text)
    else:
        print("No navbar found.")

if __name__ == '__main__':
    main()
