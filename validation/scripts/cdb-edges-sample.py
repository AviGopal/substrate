"""Edges baseline: sample N concepts, fetch their /edges, count Auto-discovered noise."""
import json
import random
import urllib.request

d = json.load(open('/tmp/cdb-all.json'))
c = d['concepts']
random.seed(42)
sample = random.sample(c, min(30, len(c)))
total_edges = 0
auto_disc = 0
edge_type_counts: dict[str, int] = {}
api_key = json.loads(open('/home/avi/.metabob/config.json').read())['metabob']['apiKey']

for x in sample:
    cid = x['id'].replace('concept:', '')
    req = urllib.request.Request(
        f'http://127.0.0.1:18260/concepts/{cid}/edges',
        headers={'Authorization': f'ApiKey {api_key}'},
    )
    try:
        r = urllib.request.urlopen(req, timeout=5).read()
        ej = json.loads(r)
        edges = ej.get('edges', []) if isinstance(ej, dict) else []
        total_edges += len(edges)
        for e in edges:
            edge = e.get('edge', e)
            et = edge.get('type') or edge.get('edge_type', '?')
            edge_type_counts[et] = edge_type_counts.get(et, 0) + 1
            desc = (edge.get('description') or '')
            if 'auto-discovered' in desc.lower():
                auto_disc += 1
    except Exception as ex:
        print(' err', cid, type(ex).__name__, ex)

print(f'Sampled {len(sample)} concepts')
print('Total edges across sample:', total_edges)
print(f'Avg edges/concept: {total_edges / len(sample):.2f}')
print(
    f'Auto-discovered noise: {auto_disc} '
    f'({100 * auto_disc / max(total_edges, 1):.1f}%)'
)
print('Edge type breakdown:', edge_type_counts)
