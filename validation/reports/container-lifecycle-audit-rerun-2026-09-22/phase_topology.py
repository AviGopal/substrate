import auditlib as a, json, time
root=a.PREFIX+'-root-a'; net=a.PREFIX+'-net-a'
def wait_identity(n,label,max_s=150):
    deadline=time.monotonic()+max_s; last=None
    while time.monotonic()<deadline:
        last=a.ex(n,'substrate-key','whoami',timeout=12)
        try:
            j=json.loads(last['stdout'])
            if j.get('valid') and a.ex(n,'systemctl','is-active','discovery-vessel',timeout=5)['stdout'].strip()=='active' and a.api(n,8100,'/registry/stats').get('status')==200: a.save(label,last);return j
        except: pass
        time.sleep(4)
    a.save(label,last);return {'valid':False}
def check(n,label):
    out={'identity':wait_identity(n,label+'-identity'),
      'registry':a.api(n,8100,'/registry/stats'),
      'bootstrap':a.api(n,8100,'/bootstrap',auth=False),
      'units':a.ex(n,'systemctl','list-units','--type=service','--state=running','--no-pager','--plain'),
      'config':a.ex(n,'substrate-config','--json','ENDPOINT'),
      'transport':a.api(n,8401,'/health',auth=False)}
    a.save(label,out);print(label,json.dumps({'identity':out['identity'],'registry':out['registry'],'transport':out['transport']}),flush=True)
    return out

# Existing network = root-a discovery fixture; independent individual owns identity/store.
b=a.launch('individual-new-org',net,{'PEER_DISCOVERY_ENDPOINTS':f'http://{root}:8100','PUBLIC_IP':a.PREFIX+'-individual-new-org','DISCOVERY_PUBLIC_PORT':'8100','IDENTITY_PUBLIC_PORT':'8101'})['name']
check(b,'case2-individual-existing-network-new-org')
a.save('case2-root-capability-query',a.api(b,8100,'/resolve',{'pointer':{'type':'vesselCapability','shape':'audit_remote_only'}}))
# Prove a foreign authority's key is not silently accepted by the local identity.
key=a.ex(root,'substrate-key','show',record=False)['stdout'].strip()
wrong=a.api(b,8101,'/v1/keys/validate',{'api_key':key},False)
a.save('wrong-authority-key',wrong);print('wrong authority status',wrong.get('status'),flush=True)
a.save('case2-stop',a.docker('kill','--signal','KILL',b,timeout=12))

# Same org on the original authority, new compute/spoke instance.
spoke_selection='discovery-vessel,goal-host-vessel,local-tools-vessel,light-dispatch-vessel,journald-stdout-forwarder,federation-transport-vessel'
def shared_env(key):
    return {'DISCOVERY_ENDPOINT':f'http://{root}:8100','HUB_DISCOVERY_URL':f'http://{root}:8100',
      'IDENTITY_VESSEL_URL':f'http://{root}:8101','ACTIVITY_API_ENDPOINT':f'http://{root}:8080',
      'METABOB_API_KEY':key,'OPENAI_API_KEY':'','ENABLED_ROLES':'spoke'}
s=a.launch('spoke-existing-org',net,shared_env(key),spoke_selection)['name']
check(s,'case6-spoke-existing-network-existing-org')
a.save('case6-dispatch',a.api(s,8210,'/run-goal',{'goal':'Report the audit vessel inventory without modifying anything.'}))
a.save('case6-stop',a.docker('kill','--signal','KILL',s,timeout=12))

# New org on the EXISTING network authority (not merely a new authority with the same slug).
login=a.api(root,8101,'/v1/auth/login',{'email':'new-org@audit.invalid','password':'AuditFixture-7!OnlyLocal'},False)
a.save('new-org-login',login)
d=login.get('data',{})
if d.get('token'):
    issued=a.api(root,8101,'/v1/keys/issue',{'user_id':d['user_id'],'org_id':d['org_id'],'scopes':['read','write','admin'],'name':'audit-new-org-hub'},False,{'Authorization':'Bearer '+d['token']})
    a.save('new-org-key-issued',issued)
    k=issued.get('data',{}).get('data',{}).get('key') or issued.get('data',{}).get('key')
    if k:
        hubenv=shared_env(k);hubenv.update({'ACTIVITY_API_ENDPOINT':'http://127.0.0.1:8080','ENABLED_ROLES':'hub','PUBLIC_IP':a.PREFIX+'-new-org-hub','DISCOVERY_PUBLIC_PORT':'8100','IDENTITY_PUBLIC_URL':f'http://{root}:8101'})
        hubselection=a.CORE.replace('identity-vessel,','').replace('identity-seeder,','')+',federation-transport-vessel'
        h=a.launch('new-org-hub',net,hubenv,hubselection)['name']
        check(h,'case5-new-org-hub-on-existing-network')
        # This is a requested hub, but its actual services/ownership are measured, not assumed.
        spenv=shared_env(k);spenv.update({'DISCOVERY_ENDPOINT':f'http://{h}:8100','HUB_DISCOVERY_URL':f'http://{h}:8100','ACTIVITY_API_ENDPOINT':f'http://{h}:8080'})
        ss=a.launch('new-org-spoke',net,spenv,spoke_selection)['name']
        check(ss,'case5-new-org-spoke-on-existing-network')
        # Reconstructed from the prior audit's superseding inline segment
        # (new-org-hub-relay-settled / case5-real-cross-instance-resolution):
        # wait for BOTH transports to hold a live relay reservation, then have
        # the spoke resolve a shape the hub owns, through libp2p.
        def relay_settled(n,label,max_s=180):
            deadline=time.monotonic()+max_s;last={}
            while time.monotonic()<deadline:
                last=a.api(n,8401,'/health',auth=False)
                t=last.get('data',{}).get('transport',{})
                if t.get('activeReservations',0)>=1 and last.get('data',{}).get('libp2p_multiaddr'):
                    break
                time.sleep(5)
            a.save(label,last);return last
        hub_t=relay_settled(h,'new-org-hub-relay-settled')
        relay_settled(ss,'new-org-spoke-relay-settled')
        target=hub_t.get('data',{}).get('libp2p_multiaddr')
        if target:
            a.save('case5-real-cross-instance-resolution',
                   a.api(ss,8401,'/egress/resolve',{'target':target,'vessel':'activity-api',
                        'impulse':{'pointer':{'type':'activeDispatches'}}}))
        a.save('case5-stop-spoke',a.docker('kill','--signal','KILL',ss,timeout=12))
        a.save('case5-stop-hub',a.docker('kill','--signal','KILL',h,timeout=12))
else: print('new org unavailable',flush=True)
print('topology phase finished',flush=True)
