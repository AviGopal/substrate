import auditlib as a,json,time
root=a.PREFIX+'-root-a';net=a.PREFIX+'-net-a'
def settle(n,label):
 deadline=time.monotonic()+90;r={}
 while time.monotonic()<deadline:
  r={'identity':a.ex(n,'substrate-key','whoami'),'registry':a.api(n,8100,'/registry/stats'),
     'goalhost':a.api(n,8210,'/health',auth=False)}
  if r['goalhost'].get('status')==200 and r['registry'].get('data',{}).get('totalVessels',0)>=3:break
  time.sleep(3)
 r['transport']=a.api(n,8401,'/health',auth=False)
 r['units']=a.ex(n,'systemctl','list-units','--type=service','--state=running','--no-pager','--plain')
 a.save(label,r);print(label,r['registry'].get('data'),flush=True);return r

key=a.ex(root,'substrate-key','show',record=False)['stdout'].strip()
common={'DISCOVERY_ENDPOINT':f'http://{root}:8100','HUB_DISCOVERY_URL':f'http://{root}:8100','IDENTITY_VESSEL_URL':f'http://{root}:8101','ACTIVITY_API_ENDPOINT':f'http://{root}:8080','METABOB_API_KEY':key,'OPENAI_API_KEY':''}
s=a.launch('spoke-two',net,common,'discovery-vessel,goal-host-vessel,local-tools-vessel,light-dispatch-vessel,federation-transport-vessel,journald-stdout-forwarder')['name']
settle(s,'case6-second-spoke-settled')
target=a.api(root,8401,'/health',auth=False)['data']['libp2p_multiaddr']
# topology killed spoke-existing-org; bring it back before resolving through it.
a.docker('start',a.PREFIX+'-spoke-existing-org',timeout=20)
settle(a.PREFIX+'-spoke-existing-org','case6-first-spoke-resettled')
for suffix in ['spoke-two','spoke-existing-org']:
 a.save(suffix+'-cross-instance',a.api(a.PREFIX+'-'+suffix,8401,'/egress/resolve',{'target':target,'vessel':'audit-fixture-vessel','impulse':{'pointer':{'type':'audit_fixture'}}}))
a.save('case6-two-spokes-visible',a.api(root,8100,'/resolve',{'pointer':{'type':'vesselCapability','shape':'activeDispatches'}}))
a.docker('kill','--signal','KILL',s,timeout=10)

# Correct new-tenant path: signup on the existing authority, login/issue key,
# then own execution+store with that identity and the network discovery anchor.
login=a.api(root,8101,'/v1/auth/login',{'email':'new-org@audit.invalid','password':'AuditFixture-7!OnlyLocal'},False)['data']
issued=a.api(root,8101,'/v1/keys/issue',{'user_id':login['user_id'],'org_id':login['org_id'],'scopes':['read','write'],'name':'audit-individual-new-tenant'},False,{'Authorization':'Bearer '+login['token']})
newkey=issued['data'].get('data',{}).get('key') or issued['data'].get('key')
env=dict(common,METABOB_API_KEY=newkey,ACTIVITY_API_ENDPOINT='http://127.0.0.1:8080')
selection=a.CORE.replace('identity-vessel,','').replace('identity-seeder,','')+',bootstrap-seeder,federation-transport-vessel'
b=a.launch('individual-new-tenant',net,env,selection)['name']
settle(b,'case2b-individual-existing-network-new-tenant')
a.save('case2b-new-tenant-dispatch',a.api(b,8210,'/run-goal',{'goal':'Run the genuine edge probe in the isolated audit.','targetTemplateId':'genuine-edge-probe-orchestrator'}))
a.save('case2b-repeat-signup',a.api(root,8101,'/v1/auth/signup',{'email':'new-org@audit.invalid','password':'AuditFixture-7!OnlyLocal','org_name':'audit-new-org'},False))
a.docker('kill','--signal','KILL',b,timeout=10)

for suffix,label in [('compose-individual','case4-final'),('new-network-existing-org','case3-final')]:
 n=a.PREFIX+'-'+suffix;a.docker('start',n,timeout=15);settle(n,label)
 a.save(label+'-dispatch',a.api(n,8210,'/run-goal',{'goal':'Run the genuine edge probe in the isolated audit.','targetTemplateId':'genuine-edge-probe-orchestrator'}))
 a.save(label+'-marker',a.ex(n,'cat','/workspace/audit-marker'))
 a.save(label+'-network-config',a.ex(n,'substrate-config','--json','DISCOVERY'))
 if suffix=='compose-individual':
  a.save(label+'-cross-instance',a.api(n,8401,'/egress/resolve',{'target':target,'vessel':'audit-fixture-vessel','impulse':{'pointer':{'type':'audit_fixture'}}}))
 a.docker('kill','--signal','KILL',n,timeout=10)
print('final checks phase finished',flush=True)
