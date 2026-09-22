import auditlib as a,json,time
root=a.PREFIX+'-root-a';net=a.network('net-b')
a.save('connect-audit-authority-net-b',a.docker('network','connect',net,root))
key=a.ex(root,'substrate-key','show',record=False)['stdout'].strip()
selection=a.CORE.replace('identity-vessel,','').replace('identity-seeder,','')+',bootstrap-seeder'
env={'IDENTITY_VESSEL_URL':f'http://{root}:8101','METABOB_API_KEY':key,'ACTIVITY_API_ENDPOINT':'http://127.0.0.1:8080'}
n=a.launch('new-network-existing-org',net,env,selection)['name']
for _ in range(35):
 if a.api(n,8100,'/registry/stats').get('status')==200:break
 time.sleep(3)
a.save('case3-individual-new-network-existing-org',{
 'identity':a.ex(n,'substrate-key','whoami'),'registry':a.api(n,8100,'/registry/stats'),
 'bootstrap':a.api(n,8100,'/bootstrap',auth=False),'config':a.ex(n,'substrate-config','--json','ENDPOINT'),
 'health':a.health(n)})
a.ex(n,'sh','-c','printf case3-marker > /workspace/audit-marker')
a.save('case3-fingerprint-before',a.fingerprint(n))
a.save('case3-stop',a.docker('stop','-t','10',n,timeout=20))
# A bounded forced stop is recorded separately if graceful stop did not settle.
if a.docker('inspect','--format','{{.State.Status}}',n,record=False)['stdout'].strip()!='exited':
 a.save('case3-force-stop',a.docker('kill','--signal','KILL',n,timeout=10))
a.save('case3-remove-container',a.docker('rm','-f',n,timeout=20))
a.save('case3-recreate',a.launch('new-network-existing-org',net,env,selection))
for _ in range(35):
 if a.api(n,8100,'/registry/stats').get('status')==200:break
 time.sleep(3)
a.save('case3-fingerprint-after',a.fingerprint(n))
a.save('case3-identity-after',a.ex(n,'substrate-key','whoami'))
a.save('case3-final-stop',a.docker('kill','--signal','KILL',n,timeout=10))
print('new-network phase finished',flush=True)
