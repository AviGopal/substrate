import auditlib as a,time,json
for suffix in ['individual-new-tenant','compose-individual','new-network-existing-org','spoke-existing-org']:
 n=a.PREFIX+'-'+suffix;a.docker('start',n,timeout=15)
 for _ in range(25):
  if a.api(n,8210,'/health',auth=False).get('status')==200:break
  time.sleep(2)
 d=a.api(n,8210,'/run-goal',{'goal':'Run the genuine edge probe in the isolated audit, terminal-outcome verification.','targetTemplateId':'genuine-edge-probe-orchestrator'})
 result={'dispatch':d};did=d.get('data',{}).get('dispatchId')
 if did:
  for _ in range(20):
   r=a.api(n,8210,'/executions/'+did);result['terminal']=r
   if r.get('data',{}).get('status') in ['completed','failed']:break
   time.sleep(2)
 a.save(suffix+'-terminal-execution',result)
 print(suffix,json.dumps(result.get('terminal',result))[:600],flush=True)
 a.docker('kill','--signal','KILL',n,timeout=10)
print('execution phase finished',flush=True)
