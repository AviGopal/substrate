import auditlib as a, json, time
n=a.PREFIX+'-root-a'
def capture(label,args,timeout=40):
    r=a.ex(n,*args,timeout=timeout);a.save(label,r);print(label,r['rc'],flush=True);return r

# Change the persisted definition, then apply it through the supported management surface.
code=r"""const p='/workspace/substrate/fleet/vessels.inventory.json';const d=await Bun.file(p).json();
d.profiles.audit_mutable=JSON.parse(process.argv[1]);await Bun.write(p,JSON.stringify(d,null,2));
let e=await Bun.file('/etc/substrate/env').text();e=e.replace(/^PROFILE=.*\n/gm,'');await Bun.write('/etc/substrate/env',e+'\nPROFILE=audit_mutable\n');"""
base=[x+'.service' for x in a.CORE.split(',')]
capture('inventory-profile-create',['bun','-e',code,json.dumps(base+['analysis-vessel.service','bootstrap-seeder.service','development-vessel-seed.service'])])
capture('inventory-add-apply',['vessel-ctl','apply'],60)
time.sleep(3)
capture('inventory-add-status',['vessel-ctl','status','analysis-vessel'])
capture('inventory-add-repeat',['vessel-ctl','apply'],60)
a.save('inventory-added-resolution',a.api(n,8250,'/health'))
capture('inventory-remove-edit',['bun','-e',code,json.dumps(base+['bootstrap-seeder.service','development-vessel-seed.service'])])
capture('inventory-remove-apply',['vessel-ctl','apply'],60)
capture('inventory-remove-status',['vessel-ctl','status','analysis-vessel'])
a.save('inventory-removed-resolution',a.api(n,8250,'/health'))
capture('inventory-restore-edit',['bun','-e',code,json.dumps(base+['analysis-vessel.service','bootstrap-seeder.service','development-vessel-seed.service'])])
capture('inventory-restore-apply',['vessel-ctl','apply'],60)
capture('inventory-restore-status',['vessel-ctl','status','analysis-vessel'])
capture('inventory-invalid-vessel',['vessel-ctl','install','audit-no-such-vessel'])
capture('inventory-invalid-profile',['sh','-c','PROFILE=audit_no_such_profile /usr/local/bin/apply-inventory'])
capture('root-a-templates-after-seed',['sh','-c','journalctl -u bootstrap-seeder -u development-vessel-seed -n 20 --no-pager'])
a.save('root-a-fingerprint-pre-restart',a.fingerprint(n))
capture('identity-reseed-repeat',['systemctl','restart','identity-seeder'],60)
a.save('root-a-fingerprint-post-reseed',a.fingerprint(n))
a.save('root-a-idempotent-wrapper',a.launch('root-a',a.PREFIX+'-net-a'))
print('inventory phase finished',flush=True)
