"""Bootstrap phase for the 2026-09-22 rerun, reconstructed from the prior
audit's command receipts (container-lifecycle-audit-2026-09-21/commands.jsonl).

Deliberate deltas from the 2026-09-21 run, each a consequence of the fixes
under test (recorded here so the evidence explains itself):
  - human-surface-vessel is reached through its baked VENDOR unit (listed in
    ENABLED_VESSELS at launch), not via `vessel-ctl install` — the install path
    into an absent workdir now REFUSES by design. The refusal is captured as
    evidence for an additional check, not used to provision the vessel.
  - federation-relay is installed with ZERO manifest edits: the baked-path
    workdir is now the shipped default. Whether any workaround was needed is
    itself a scored result (relay_installs_out_of_box).
"""
import auditlib as a, json, time, datetime

image = a.state()['image'] if a.STATE.exists() else a.init()
a.save('image-provenance', {
    'image_id': image,
    'image_ref': 'ghcr.io/avigopal/substrate:dev',
    'built_from_super_repo_commit': '254bf8c9',
    'notable_included_fixes': [
        'activity-api 41c9e89 (023/045/055 fresh-datastore schema fixes)',
        'development-vessel 1a18944 (surql landing gate restoration)',
        'super-repo 0bb3e9d4 (uiFeedback response_id required)',
        'super-repo 86436189 (ui/dist baked)',
        'super-repo 337c9226 (installed.json durable membership + workdir refusal)',
        'super-repo e1c06f60 (relay baked workdir + reservation-gated join)'],
    'rerun_started': datetime.datetime.now(datetime.timezone.utc).isoformat(),
})
net = a.network('net-a')
root = a.launch('root-a', net, selection=a.CORE + ',human-surface-vessel')['name']

# --- identity settles -------------------------------------------------------
ident = None
for _ in range(60):
    r = a.ex(root, 'substrate-key', 'whoami', timeout=12)
    try:
        j = json.loads(r['stdout'])
        if j.get('valid'):
            ident = r
            break
    except Exception:
        pass
    time.sleep(4)
a.save('root-a-identity', ident or r)
print('identity valid:', bool(ident), flush=True)

# --- fixture org for the existing-authority cases ---------------------------
signup = a.api(root, 8101, '/v1/auth/signup',
               {'email': 'new-org@audit.invalid', 'password': 'AuditFixture-7!OnlyLocal',
                'org_name': 'audit-new-org'}, False)
a.save('new-org-signup', signup)
print('signup status', signup.get('status'), flush=True)

# --- seeders: profile that includes them, then start explicitly -------------
code = r"""const p='/workspace/substrate/fleet/vessels.inventory.json';const d=await Bun.file(p).json();
d.profiles.audit_mutable=JSON.parse(process.argv[1]);await Bun.write(p,JSON.stringify(d,null,2));
let e=await Bun.file('/etc/substrate/env').text();e=e.replace(/^PROFILE=.*\n/gm,'');await Bun.write('/etc/substrate/env',e+'\nPROFILE=audit_mutable\n');"""
base = [x + '.service' for x in (a.CORE + ',human-surface-vessel').split(',')]
a.save('bootstrap-profile-create', a.ex(root, 'bun', '-e', code,
    json.dumps(base + ['analysis-vessel.service', 'bootstrap-seeder.service', 'development-vessel-seed.service'])))
a.save('bootstrap-profile-apply', a.ex(root, 'vessel-ctl', 'apply', timeout=60))
a.save('seed-start', a.ex(root, 'systemctl', 'start', '--no-block', 'bootstrap-seeder', 'development-vessel-seed', timeout=20))
tmpl = {}
for _ in range(45):
    tmpl = a.api(root, 8080, '/v2/activities/templates?limit=1')
    if tmpl.get('status') == 200 and (tmpl.get('data', {}).get('templates') or tmpl.get('data', {}).get('data')):
        break
    time.sleep(4)
a.save('templates', tmpl)
a.save('seed-log', a.ex(root, 'sh', '-c', 'journalctl -u bootstrap-seeder -u development-vessel-seed -n 45 --no-pager'))
print('templates status', tmpl.get('status'), flush=True)

# --- human surface via the vendor unit; the install path must refuse --------
refusal = a.ex(root, 'vessel-ctl', 'install', 'human-surface-vessel', timeout=30)
a.save('surface-install-refusal', refusal)
page = a.api(root, 8310, '/', auth=False)
a.save('surface-page', page)
print('surface / status', page.get('status'), 'install rc', refusal['rc'], flush=True)

# --- relay: out-of-box install, no manifest edits ---------------------------
ip = a.ex(root, 'sh', '-c', "hostname -i | awk '{print $1}'")['stdout'].strip()
envcode = r"""let e=await Bun.file('/etc/substrate/env').text();
for(const[k,v]of Object.entries(JSON.parse(process.argv[1]))){e=e.split('\n').filter(l=>!l.startsWith(k+'=')).join('\n')+'\n'+k+'='+v+'\n';}
await Bun.write('/etc/substrate/env',e);"""
a.save('relay-public-env', a.ex(root, 'bun', '-e', envcode, json.dumps({
    'PUBLIC_IP': ip, 'FED_PUBLIC_IP': ip,
    'DISCOVERY_PUBLIC_URL': f'http://{ip}:8100', 'IDENTITY_PUBLIC_URL': f'http://{ip}:8101'})))
manifest_before = a.ex(root, 'sha256sum', '/workspace/substrate/fleet/vessels.manifest.json')
relay_install = a.ex(root, 'vessel-ctl', 'install', 'federation-relay', timeout=45)
a.save('relay-install-out-of-box', relay_install)
manifest_after = a.ex(root, 'sha256sum', '/workspace/substrate/fleet/vessels.manifest.json')
a.save('relay-manifest-untouched', {'before': manifest_before, 'after': manifest_after})
a.save('relay-discovery-restart', a.ex(root, 'vessel-ctl', 'restart', 'discovery-vessel', timeout=30))
boot = {}
for _ in range(25):
    boot = a.api(root, 8100, '/bootstrap', auth=False)
    if boot.get('status') == 200 and boot.get('data', {}).get('relay_multiaddrs'):
        break
    time.sleep(4)
a.save('relay-bootstrap-after-install', boot)
print('relay multiaddrs', bool(boot.get('data', {}).get('relay_multiaddrs')), flush=True)
a.save('transport-install-root', a.ex(root, 'vessel-ctl', 'install', 'federation-transport-vessel', timeout=45))

# --- deterministic dispatch + durable trace listing -------------------------
d = a.api(root, 8210, '/run-goal',
          {'goal': 'Run the genuine edge probe in the isolated audit, terminal-outcome verification.',
           'targetTemplateId': 'genuine-edge-probe-orchestrator'})
result = {'dispatch': d}
did = d.get('data', {}).get('dispatchId')
if did:
    for _ in range(25):
        r = a.api(root, 8210, '/executions/' + did)
        result['terminal'] = r
        if r.get('data', {}).get('status') in ['completed', 'failed']:
            break
        time.sleep(2)
a.save('deterministic-dispatch-result', result)
traces = a.api(root, 8080, '/v2/activities/execution-traces?limit=5')
a.save('dispatch-durable-traces', traces)
n = traces.get('data', {})
print('durable traces status', traces.get('status'),
      'has rows', bool((n.get('executions') or n.get('traces') or n.get('data') or [])), flush=True)
print('bootstrap phase finished', flush=True)
