"""One-shot baseline measurement script for concept-db state at 2026-05-30.
Reads /tmp/cdb-all.json (a fresh /concepts/search?limit=500 dump) and prints
content/topology/tags baselines.
"""
import json
from collections import Counter

d = json.load(open('/tmp/cdb-all.json'))
c = d['concepts']
print('TOTAL CONCEPTS:', len(c))
with_path = [x for x in c if x.get('pointer', {}).get('path')]
print('with pointer.path:', len(with_path), f'({100 * len(with_path) / len(c):.1f}%)')
long_summary = [x for x in c if x.get('summary') and len(x['summary']) > 80]
print('summary > 80 chars:', len(long_summary), f'({100 * len(long_summary) / len(c):.1f}%)')
xml_leak = [x for x in c if x.get('content') and ('</content>' in x['content'] or '<content>' in x['content'])]
print('content has <content> tag leak:', len(xml_leak))
sample = c[0]
print('sample keys:', list(sample.keys()))
print('sample pointer:', sample.get('pointer'))
print('sample tags:', sample.get('tags'))
shapes = Counter(x.get('shape', 'None') for x in c)
print('top 15 shapes:', shapes.most_common(15))
orphans = [x for x in c if x.get('times_loaded', 0) == 0 and x.get('times_succeeded', 0) == 0]
print('orphan candidates (no loads/successes):', len(orphans))
src = Counter(x.get('source_type', 'None') for x in c)
print('source_type:', src.most_common(10))
banned = {'overview', 'related', 'key_files', 'mcp_tools', 'environment_variables', 'before_push', 'references'}
banned_shapes = [x for x in c if x.get('shape') in banned]
print('concepts with banned shape names:', len(banned_shapes))
