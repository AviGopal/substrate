import auditlib as a,json,time,tempfile,pathlib,hashlib,shutil,os
root=a.PREFIX+'-root-a'
def settle(n):
 for _ in range(40):
  r=a.ex(n,'substrate-key','whoami',timeout=6)
  if '"valid": true' in r['stdout'] and a.api(n,8210,'/health',auth=False).get('status')==200:return r
  time.sleep(2)
 return r

a.save('root-graceful-stop',a.docker('stop','-t','15',root,timeout=25))
if a.docker('inspect','--format','{{.State.Status}}',root,record=False)['stdout'].strip()!='exited':
 a.save('root-stop-fallback',a.docker('kill','--signal','KILL',root,timeout=10))

private=pathlib.Path(tempfile.mkdtemp(prefix=a.PREFIX+'-backup-'))
os.chmod(private,0o700)
try:
 exports=[]
 for part in ['workspace','surreal']:
  p=private/(part+'.tar')
  r=a.docker('volume','export',root+'-'+part,'--output',str(p),timeout=60)
  a.save('backup-export-'+part,r)
  assert r['rc']==0,r
  os.chmod(p,0o600)
  exports.append({'part':part,'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 a.save('backup-manifest',exports)
 a.save('root-remove-for-recreate',a.docker('rm',root,timeout=20))
 a.save('root-recreate',a.launch('root-a',a.PREFIX+'-net-a',{'PROFILE':'audit_mutable'}))
 a.save('root-identity-after-recreate',settle(root))
 a.save('root-fingerprint-after-recreate',a.fingerprint(root))
 a.save('root-manifest-after-recreate',a.ex(root,'sha256sum','/workspace/substrate/fleet/vessels.manifest.json'))
 a.save('root-dynamic-vessel-after-recreate',{'status':a.ex(root,'vessel-ctl','status','audit-fixture-vessel'),'resolve':a.api(root,8399,'/resolve',{'impulse':{'pointer':{'type':'audit_fixture'}}})})
 a.save('root-analysis-after-recreate',{'status':a.ex(root,'vessel-ctl','status','analysis-vessel'),'health':a.api(root,8250,'/health',auth=False)})
 a.save('root-reinstall-persisted-vessel',a.ex(root,'vessel-ctl','install','audit-fixture-vessel',timeout=25))
 a.save('root-restored-vessel-resolution',a.api(root,8399,'/resolve',{'impulse':{'pointer':{'type':'audit_fixture'}}}))
 a.save('root-final-stop',a.docker('stop','-t','10',root,timeout=20))
 print('same-volume recreation measured',flush=True)

 # Restore BOTH exported volumes into fresh volumes. Source instance is stopped.
 restored=a.PREFIX+'-backup-restored'
 for part in ['workspace','surreal']:
  v=restored+'-'+part;a.register('volumes',v)
  assert a.docker('volume','create','--label',a.LABEL,v)['rc']==0
  r=a.docker('volume','import',v,str(private/(part+'.tar')),timeout=60)
  a.save('backup-import-'+part,r);assert r['rc']==0,r
 a.save('backup-restored-launch',a.launch('backup-restored',a.PREFIX+'-net-b',{'PROFILE':'audit_mutable'}))
 a.save('backup-restored-identity',settle(restored))
 a.save('backup-restored-fingerprint',a.fingerprint(restored))
 a.save('backup-restored-templates',a.api(restored,8080,'/v2/activities/templates?limit=1'))
 a.save('backup-restored-stop',a.docker('stop','-t','10',restored,timeout=20))
 print('fresh-volume backup restore measured',flush=True)
finally:
 shutil.rmtree(private)
 a.save('private-backup-cleanup',{'path':str(private),'exists':private.exists()})
