import auditlib as a,json,time
n=a.PREFIX+'-root-a'
def resolve(label,p):
 r=a.api(n,8310,'/v2/impulses/resolve',{'impulse':{'pointer':p}});a.save(label,r);print(label,r.get('status'),flush=True);return r
q={'type':'uiQuestion_write','id':'audit-required-question','kind':'question','title':'Audit: choose a deployment scope','body':{'text':'Synthetic test. No real deployment will be authorized.'},'asks':[{'id':'scope','prompt':'Choose a scope'}]}
r=resolve('human-question-created',q)
rev=r.get('data',{}).get('body',{}).get('revision',1)
resolve('human-question-pending',{'type':'uiQuestion','id':q['id']})
resolve('human-contentless-write',{'type':'uiQuestion_write','id':q['id']})
q['title']='Audit: revised scope question'
r=resolve('human-question-revised',q)
newrev=r.get('data',{}).get('body',{}).get('revision',2)
feedback={'type':'uiFeedback','panel_id':q['id'],'panel_revision':rev,'ask_id':'scope','value':'audit-only','kind':'answer','response_id':'audit-response-stale'}
resolve('human-stale-answer',feedback)
feedback.update(panel_revision=newrev,response_id='audit-response-accepted')
resolve('human-valid-answer',feedback)
resolve('human-repeat-answer',feedback)
resolve('human-after-answer',{'type':'uiQuestion','id':q['id']})
resolve('human-unknown-ask',dict(feedback,ask_id='not-present',response_id='audit-response-unknown'))
a.save('human-service-restart',a.ex(n,'vessel-ctl','restart','human-surface-vessel',timeout=20))
time.sleep(2)
resolve('human-after-restart',{'type':'uiQuestion','id':q['id']})
a.save('human-page-after-restart',a.api(n,8310,'/',auth=False))
a.save('root-readiness-once',a.ex(n,'substrate-ready','--once','--json',timeout=30))
a.save('root-doctor',a.ex(n,'substrate-doctor',timeout=35))
a.save('root-health-summary',a.health(n))
print('human phase finished',flush=True)
