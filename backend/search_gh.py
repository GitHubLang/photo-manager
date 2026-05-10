import urllib.request, json

token = 'ghp_c1WkZNldtGq0c2DcMdBZHXe1aMPKip0T0d5r'

queries = [
    'cube+lut+to+xmp+lightroom',
    'HALD+CLUT+xmp+preset',
    '3dlut+creator+lightroom+python',
    'raw-alchemy',
    'LUTify',
]

for q in queries:
    url = f'https://api.github.com/search/repositories?q={q}&sort=stars&order=desc&per_page=5'
    req = urllib.request.Request(url, headers={
        'Authorization': f'Bearer {token}',
        'Accept': 'application/vnd.github+json'
    })
    try:
        r = urllib.request.urlopen(req)
        d = json.loads(r.read())
        print(f'\n=== {q} ===')
        for item in d.get('items', []):
            desc = (item.get('description') or '')[:120]
            print(f"{item['full_name']} stars={item['stargazers_count']}")
            print(f"  {desc}")
            print(f"  url: {item['html_url']}")
    except Exception as e:
        print(f'Error for {q}: {e}')
