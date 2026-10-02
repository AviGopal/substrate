import auditlib as a, time, json
net=a.PREFIX+'-net-a'
cases=[
 ('no-provider',{'OPENAI_API_KEY':''},a.CORE),
 ('invalid-profile',{'PROFILE':'audit_does_not_exist'},a.CORE),
 ('invalid-vessel',{},'audit_does_not_exist'),
 ('unreachable-hub',{'OPENAI_API_KEY':'','DISCOVERY_ENDPOINT':'http://192.0.2.1:8100','METABOB_API_KEY':'invalid-audit-key'},'discovery-vessel'),
 ('wrong-key',{'OPENAI_API_KEY':'','DISCOVERY_ENDPOINT':f'http://{a.PREFIX}-root-a:8100','IDENTITY_VESSEL_URL':f'http://{a.PREFIX}-root-a:8101','ACTIVITY_API_ENDPOINT':f'http://{a.PREFIX}-root-a:8080','METABOB_API_KEY':'invalid-audit-key'},'discovery-vessel'),
]
for suffix,env,selection in cases:
    n=a.launch(suffix,net,env,selection)['name']
    time.sleep(3)
    r={'state':a.docker('inspect','--format','{{json .State}}',n),
       'logs':a.docker('logs','--tail','30',n),
       'identity':a.ex(n,'substrate-key','whoami',timeout=10)}
    a.save('failure-'+suffix,r)
    print(suffix,r['state']['stdout'][:180],flush=True)
    a.docker('stop','-t','3',n,timeout=12)
print('failure phase finished',flush=True)
