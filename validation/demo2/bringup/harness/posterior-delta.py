# Computed delta caption — the same discipline as cmd_verdict. The number a
# learning demo states is exactly the number that must never be hand-written:
# "alpha moved +0.7" as prose is the defect class this session spent five
# commits killing.
import json,sys
b=json.load(open(sys.argv[1])); a=json.load(open(sys.argv[2]))
d=lambda k: a[k]-b[k]
print(f"BEFORE  alpha={b['alpha']:.4f}  beta={b['beta']:.4f}  n={b['n']}  successes={b['succ']}")
print(f"AFTER   alpha={a['alpha']:.4f}  beta={a['beta']:.4f}  n={a['n']}  successes={a['succ']}")
print(f"DELTA   alpha={d('alpha'):+.4f}  beta={d('beta'):+.4f}  n={d('n'):+d}  successes={d('succ'):+d}")
print()
if d('n')==0:
    print("VERDICT: the arm did not execute. This measures nothing about learning —")
    print("         a coalesced or unselected dispatch looks exactly like a dead channel.")
elif d('alpha')>0 or d('beta')>0:
    print(f"VERDICT: the posterior MOVED on {d('n')} execution(s). Credit is flowing.")
    print("         This is an independent read of the store, not the dispatch's own")
    print("         alphaBetaDelta field - a channel's own reporting is not evidence")
    print("         about the channel.")
else:
    print(f"VERDICT: {d('n')} execution(s) recorded and the posterior did NOT move.")
    print("         The arm ran and learned nothing.")
