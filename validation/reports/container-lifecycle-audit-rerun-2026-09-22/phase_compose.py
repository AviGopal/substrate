import auditlib as a, json, os, time
n=a.PREFIX+'-compose-individual'; root=a.PREFIX+'-root-a'
key=a.ex(root,'substrate-key','show',record=False)['stdout'].strip()
selection=a.CORE.replace('identity-vessel,','').replace('identity-seeder,','')+',bootstrap-seeder'
vols=[n+'-workspace',n+'-surreal']
for v in vols:
    if v not in a.state()['volumes']:
        a.register('volumes',v);assert a.docker('volume','create','--label',a.LABEL,v)['rc']==0
a.register('containers',n)
spec={'services':{'substrate':{
 'image':a.state()['image'],'container_name':n,'hostname':n,'privileged':True,
 'mem_limit':'4g','cpus':2,'pids_limit':1024,'stop_signal':'SIGRTMIN+3','stop_grace_period':'10s',
 'labels':{'substrate.lifecycle.audit':a.PREFIX},'tmpfs':['/run','/run/lock'],
 'environment':{'METABOB_API_KEY':'${AUDIT_JOIN_KEY}',
 'DISCOVERY_ENDPOINT':f'http://{root}:8100','HUB_DISCOVERY_URL':f'http://{root}:8100',
 'IDENTITY_VESSEL_URL':f'http://{root}:8101','ACTIVITY_API_ENDPOINT':'http://127.0.0.1:8080',
 'MITOSIS_DIRECT_PUSH':'0','ROUTE_EDIT_INTENT_TO_COMPOSE':'0','ENABLED_VESSELS':selection},
 'volumes':['workspace:/workspace','surreal:/var/lib/surrealdb'],'networks':['audit']}},
 'volumes':{'workspace':{'external':True,'name':vols[0]},'surreal':{'external':True,'name':vols[1]}},
 'networks':{'audit':{'external':True,'name':a.PREFIX+'-net-a'}}}
p=a.ROOT/'compose-audit.json';p.write_text(json.dumps(spec,indent=2))
env=dict(os.environ,AUDIT_JOIN_KEY=key)
cmd=['docker','compose','-f',str(p),'-p',a.PREFIX+'-compose']
def compose(label,*args):
 r=a.run(cmd+list(args),env=env,timeout=50);a.save(label,r);print(label,r['rc'],flush=True);return r
compose('compose-first-up','up','-d','--no-build')
for _ in range(35):
 if a.api(n,8100,'/registry/stats').get('status')==200:break
 time.sleep(3)
a.ex(n,'sh','-c','printf compose-marker > /workspace/audit-marker')
a.save('compose-identity-before',a.ex(n,'substrate-key','whoami'))
a.save('compose-fingerprint-before',a.fingerprint(n))
a.save('compose-container-before',a.docker('inspect','--format','{{.Id}} {{.State.StartedAt}}',n))
compose('compose-repeat-up','up','-d','--no-build')
a.save('compose-container-after-repeat',a.docker('inspect','--format','{{.Id}} {{.State.StartedAt}}',n))
a.save('compose-fingerprint-after-repeat',a.fingerprint(n))
compose('compose-recreate','up','-d','--no-build','--force-recreate')
for _ in range(35):
 if a.api(n,8100,'/registry/stats').get('status')==200:break
 time.sleep(3)
a.save('compose-identity-after-recreate',a.ex(n,'substrate-key','whoami'))
a.save('compose-fingerprint-after-recreate',a.fingerprint(n))
a.save('case4-individual-existing-network-existing-org',{
 'registry':a.api(n,8100,'/registry/stats'),'bootstrap':a.api(n,8100,'/bootstrap',auth=False),
 'identity':a.ex(n,'substrate-key','whoami'),'transport':a.api(n,8401,'/health',auth=False),
 'dispatch':a.api(n,8210,'/run-goal',{'goal':'Run the genuine edge probe in the isolated audit.','targetTemplateId':'genuine-edge-probe-orchestrator'})})
compose('compose-stop','stop')
compose('compose-resume','up','-d','--no-build')
a.save('compose-post-resume-marker',a.ex(n,'cat','/workspace/audit-marker'))
a.save('compose-final-stop',a.docker('kill','--signal','KILL',n,timeout=12))
print('compose phase finished',flush=True)
