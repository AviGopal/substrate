"""Isolated audit controls; never targets an unowned resource for mutation."""
import datetime, hashlib, json, os, pathlib, re, subprocess, time

ROOT = pathlib.Path(__file__).resolve().parent
PREFIX = 'sla-0922r-' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:6]
LABEL = 'substrate.lifecycle.audit=' + PREFIX
STATE = ROOT / 'resources.json'

def scrub(value):
    if isinstance(value, dict):
        return {k: ('[redacted]' if re.search(r'^(token|key|api_key|password|secret|authorization)$', k, re.I) else scrub(v)) for k,v in value.items()}
    if isinstance(value, list): return [scrub(v) for v in value]
    if not isinstance(value, str): return value
    value = re.sub(r'mb-[A-Za-z0-9_+/=-]+', '[redacted-key]', value)
    value = re.sub(r'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+', '[redacted-jwt]', value)
    return re.sub(r'(?im)^([^\n]*(?:SECRET|PASSWORD|_PASS|_KEY|TOKEN)=).+$', r'\1[redacted]', value)

def run(args, timeout=40, record=True, input=None, env=None):
    at = datetime.datetime.now(datetime.timezone.utc).isoformat()
    try:
        p = subprocess.run(args, input=input, text=True, capture_output=True, timeout=timeout, env=env)
        r = {'at':at, 'argv':scrub(args), 'rc':p.returncode, 'stdout':p.stdout, 'stderr':p.stderr}
    except subprocess.TimeoutExpired as e:
        r = {'at':at, 'argv':scrub(args), 'rc':124, 'stdout':scrub((e.stdout or b'').decode() if isinstance(e.stdout,bytes) else e.stdout or ''), 'stderr':'timeout'}
    if record:
        with (ROOT/'commands.jsonl').open('a') as f: f.write(json.dumps(scrub(r))+'\n')
    return r

def docker(*args, **kw): return run(['docker', *args], **kw)
def owned(name):
    assert name.startswith(PREFIX+'-'), name
    return name
def ex(name, *args, **kw): return docker('exec', owned(name), *args, **kw)
def save(name, value): (ROOT/(name+'.json')).write_text(json.dumps(scrub(value),indent=2)+'\n')
def state(): return json.loads(STATE.read_text())
def snapshot():
    cs=json.loads(docker('ps','-aq','--format','json',record=False)['stdout'] or '[]')
    # Podman format json is a list of records, not IDs.
    ids=[c['Id'] if 'Id' in c else c['ID'] for c in cs]
    rows=[]
    for cid in ids:
        obj=json.loads(docker('inspect',cid,record=False)['stdout'])[0]
        rows.append({'id':obj['Id'],'name':obj['Name'],'image':obj['Image'],
          'started':obj['State']['StartedAt'],'mounts':obj['Mounts'],
          'networks':obj['NetworkSettings'].get('Networks',{})})
    return {'containers':rows,'networks':docker('network','ls','--format','json',record=False)['stdout'],
      'volumes':docker('volume','ls','--format','json',record=False)['stdout']}

def init():
    assert not STATE.exists(), 'audit already initialized'
    save('before',snapshot())
    image=json.loads(docker('image','inspect','ghcr.io/avigopal/substrate:dev',record=False)['stdout'])[0]['Id']
    STATE.write_text(json.dumps({'prefix':PREFIX,'image':image,'containers':[],'volumes':[],'networks':[]}))
    return image

def register(kind,name):
    s=state()
    if name not in s[kind]: s[kind].append(name)
    STATE.write_text(json.dumps(s,indent=2))

def network(suffix):
    name=owned(PREFIX+'-'+suffix)
    if name not in state()['networks']:
        assert docker('network','inspect',name,record=False)['rc'] != 0
        register('networks',name)
        r=docker('network','create','--internal','--label',LABEL,name)
        assert r['rc']==0,r
    return name

CORE='surrealdb,valkey,discovery-vessel,identity-vessel,activity-api,identity-seeder,local-tools-vessel,goal-host-vessel,development-vessel,concept-db,journald-stdout-forwarder'
def launch(suffix,net,env=None,selection=CORE):
    name=owned(PREFIX+'-'+suffix)
    if docker('container','exists',name,record=False)['rc']==0:
        assert name in state()['containers']
        running=docker('inspect','--format','{{.State.Running}}',name,record=False)['stdout'].strip()
        if running!='true': docker('start',name,timeout=30)
        return {'name':name,'already_exists':True}
    volumes=[]
    for part in ['workspace','surreal']:
        v=name+'-'+part
        if v not in state()['volumes']:
            assert docker('volume','inspect',v,record=False)['rc'] != 0
            register('volumes',v)
            assert docker('volume','create','--label',LABEL,v)['rc']==0
        volumes.append(v)
    settings={'OPENAI_API_KEY':'audit-fixture-not-a-provider-credential',
      'OPENAI_BASE_URL':'http://127.0.0.1:19999/v1','LLM_DEFAULT_MODEL':'audit-unavailable',
      'MITOSIS_DIRECT_PUSH':'0','ROUTE_EDIT_INTENT_TO_COMPOSE':'0',
      'SUBSTRATE_GIT_PAT':'','GITHUB_TOKEN':'','ENABLED_VESSELS':selection}
    settings.update(env or {})
    args=['run','-d','--name',name,'--hostname',name,'--label',LABEL,'--network',owned(net),
      '--privileged','--memory','4g','--cpus','2','--pids-limit','1024',
      '--tmpfs','/run','--tmpfs','/run/lock','-v',volumes[0]+':/workspace',
      '-v',volumes[1]+':/var/lib/surrealdb']
    for k,v in settings.items(): args.extend(['-e',k+'='+v])
    args.append(state()['image'])
    register('containers',name)
    r=docker(*args,timeout=60)
    return {'name':name,'result':r}

def health(name):
    return ex(name,'sh','-c','systemctl is-system-running; systemctl --failed --no-pager; substrate-key whoami; curl -s --max-time 3 http://127.0.0.1:8210/health',timeout=15)

def api(name,port,path,body=None,auth=True,headers=None):
    spec={'url':f'http://127.0.0.1:{port}{path}','body':body,'auth':auth,'headers':headers or {}}
    code='''const s=JSON.parse(process.argv[1]); const txt=await Bun.file('/etc/substrate/env').text();
const key=txt.match(/^METABOB_API_KEY=["']?([^"'\\n]+)/m)?.[1]??'';
try { const r=await fetch(s.url,{method:s.body===null?'GET':'POST',headers:{'Content-Type':'application/json',...(s.auth?{Authorization:'ApiKey '+key}:{}),...s.headers},body:s.body===null?undefined:JSON.stringify(s.body),signal:AbortSignal.timeout(8000)});
const t=await r.text(); let data; try{data=JSON.parse(t)}catch{data=t} console.log(JSON.stringify({status:r.status,data})); }catch(e){console.log(JSON.stringify({status:0,error:String(e)}));}'''
    r=ex(name,'bun','-e',code,json.dumps(spec),timeout=12)
    try: return json.loads(r['stdout'])
    except: return r

def fingerprint(name):
    code='''import{createHash}from'node:crypto';const txt=await Bun.file('/etc/substrate/env').text(); const vals={};
for(const k of ['METABOB_API_KEY','API_KEY_SECRET','SURREAL_PASS','JWT_SECRET']){const v=txt.split('\\n').find(l=>l.startsWith(k+'='))??'';vals[k+'_sha256']=createHash('sha256').update(v).digest('hex');}
for(const p of ['/workspace/audit-marker','/workspace/substrate/fleet/vessels.inventory.json']){const f=Bun.file(p);vals[p]=await f.exists()?createHash('sha256').update(await f.text()).digest('hex'):null;}console.log(JSON.stringify(vals));'''
    r=ex(name,'bun','-e',code)
    return json.loads(r['stdout'])

def cleanup():
    s=state(); results=[]
    for n in reversed(s['containers']):
        r=docker('inspect',owned(n),record=False)
        if r['rc']!=0: continue
        assert json.loads(r['stdout'])[0]['Config']['Labels'].get('substrate.lifecycle.audit')==PREFIX
        results.append(docker('rm','-f',n,timeout=60))
    for kind in ['volume','network']:
        for n in reversed(s[kind+'s']):
            r=docker(kind,'inspect',owned(n),record=False)
            if r['rc']!=0: continue
            obj=json.loads(r['stdout'])[0]
            assert (obj.get('Labels') or obj.get('labels') or {}).get('substrate.lifecycle.audit')==PREFIX
            results.append(docker(kind,'rm',n,timeout=30))
    save('cleanup',results); save('after',snapshot())
