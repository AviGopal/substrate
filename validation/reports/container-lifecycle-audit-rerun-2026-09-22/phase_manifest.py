import auditlib as a, json, time
n=a.PREFIX+'-root-a'
# A synthetic capability is a test fixture, not claimed to be a learned activity.
source=r'''const port=8399;const id='audit-fixture-vessel';
Bun.serve({port,hostname:'0.0.0.0',fetch:async r=>Response.json(new URL(r.url).pathname==='/health'?{status:'ok',vessel:id}:{resolved:true,shape:'audit_fixture',body:{value:'isolated-manifest-v1',vessel:id}})});
async function register(){try{const r=await fetch('http://127.0.0.1:8100/register',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'ApiKey '+process.env.METABOB_API_KEY},body:JSON.stringify({vesselId:id,endpoint:'http://127.0.0.1:'+port,resolve_endpoint:'http://127.0.0.1:'+port+'/resolve',shapes:['audit_fixture'],version:'audit-fixture-v1'})});console.log('register',r.status)}catch(e){console.log(String(e))}}await register();setInterval(register,20000);'''
config={'name':'audit-fixture-vessel','description':'Isolated audit fixture, not product capability','workdir':'/workspace/audit-vessel','exec':'index.ts','env':{'PORT':'8399'},'secrets':[],'restart':'always','health_port':8399,'self_recovery':False}
script=r'''await Bun.write('/workspace/audit-vessel/index.ts',process.argv[1]);await Bun.write('/workspace/audit-vessel/package.json','{"name":"audit-fixture","version":"0.0.0"}');const p='/workspace/substrate/fleet/vessels.manifest.json';const d=await Bun.file(p).json();d.vessels=d.vessels.filter(v=>v.name!=='audit-fixture-vessel');d.vessels.push(JSON.parse(process.argv[2]));await Bun.write(p,JSON.stringify(d,null,2));'''
a.save('manifest-fixture-creation',a.ex(n,'bun','-e',script,source,json.dumps(config)))
for i in range(2):
 r=a.ex(n,'vessel-ctl','install','audit-fixture-vessel',timeout=30);a.save(f'manifest-install-{i+1}',r);print('install',i,r['rc'],flush=True)
 time.sleep(2)
 a.save(f'manifest-live-{i+1}',{'health':a.api(n,8399,'/health',auth=False),'resolve':a.api(n,8399,'/resolve',{'impulse':{'pointer':{'type':'audit_fixture'}}}),'discovery':a.api(n,8100,'/resolve',{'pointer':{'type':'vesselCapability','shape':'audit_fixture'}})})
for i in range(2):
 r=a.ex(n,'vessel-ctl','uninstall','audit-fixture-vessel',timeout=20);a.save(f'manifest-uninstall-{i+1}',r);print('uninstall',i,r['rc'],flush=True)
 a.save(f'manifest-absent-{i+1}',{'health':a.api(n,8399,'/health',auth=False),'discovery':a.api(n,8100,'/resolve',{'pointer':{'type':'vesselCapability','shape':'audit_fixture'}})})
r=a.ex(n,'vessel-ctl','install','audit-fixture-vessel',timeout=30);a.save('manifest-reinstall',r)
a.save('manifest-restored',a.api(n,8399,'/resolve',{'impulse':{'pointer':{'type':'audit_fixture'}}}))
print('manifest phase finished',flush=True)
