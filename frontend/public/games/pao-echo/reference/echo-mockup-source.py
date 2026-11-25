import sys, math; sys.path.insert(0,'/home/claude/pao2')
import pword as W
from pword import ico, IC, star, ill, CARD, sun, medal, LOOK
from playwright.sync_api import sync_playwright
IC.update({'mic':'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3M8 21h8"/>','turtle':'<path d="M4 15a8 6 0 0116 0z"/><path d="M20 12a2.5 2.5 0 014 1M6 15v3M16 15v3"/>','level':'<path d="M4 20V10M10 20V4M16 20v-8M22 20V8"/>','ear':IC.get('ear','')})
def turtle(s=110,face=True):
    return (f'<svg width="{s}" height="{s*.72:.0f}" viewBox="0 0 140 100" style="overflow:visible"><ellipse cx="38" cy="86" rx="12" ry="9" fill="#5FBF7A" stroke="#2F8F55" stroke-width="3"/><ellipse cx="98" cy="86" rx="12" ry="9" fill="#5FBF7A" stroke="#2F8F55" stroke-width="3"/>'
            '<path d="M18 80C14 78 8 80 6 86C12 88 18 86 22 84z" fill="#5FBF7A" stroke="#2F8F55" stroke-width="3" stroke-linejoin="round"/>'
            '<circle cx="118" cy="56" r="19" fill="#7ED494" stroke="#2F8F55" stroke-width="3"/><circle cx="124" cy="52" r="3.6" fill="#1B3B2A"/><circle cx="125.2" cy="50.8" r="1.2" fill="#fff"/><path d="M118 63q6 5 13 1" stroke="#1B3B2A" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="112" cy="62" r="4" fill="#FB7185" opacity=".4"/>'
            '<path d="M14 82C14 36 40 20 70 20C100 20 126 36 126 82z" fill="#34A56A" stroke="#1F7A4A" stroke-width="3.4" stroke-linejoin="round"/>'
            '<path d="M70 20L56 40L70 58L84 40zM56 40L30 44M84 40L110 44M70 58L70 82M56 40L42 66M84 40L98 66" fill="none" stroke="#1F7A4A" stroke-width="2.8" stroke-linejoin="round" opacity=".7"/>'
            '<path d="M70 20L56 40L70 58L84 40z" fill="#5FD08C"/><ellipse cx="44" cy="40" rx="10" ry="5" fill="#fff" opacity=".35" transform="rotate(-24 44 40)"/></svg>')
# extra word pictures
def pic(n,s=100):
    if n in ('apple',): return ill('apple',s)
    D={'pencil':'<path d="M22 74L66 22L82 36L38 88z" fill="#FB923C" stroke="#C2410C" stroke-width="3" stroke-linejoin="round"/><path d="M66 22L82 36L90 26Q94 20 88 14L84 10Q78 6 72 12z" fill="#F43F5E" stroke="#BE123C" stroke-width="3" stroke-linejoin="round"/><path d="M22 74L38 88L16 94z" fill="#FDE68A" stroke="#C2410C" stroke-width="3" stroke-linejoin="round"/><path d="M16 94L20 84L26 90z" fill="#1B1250"/><path d="M58 32L74 46" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".5"/>',
       'balloon':'<path d="M50 94L44 100H56z" fill="#F43F5E"/><path d="M50 92Q44 100 52 106" stroke="#64748B" stroke-width="2.4" fill="none"/><path d="M50 8C28 8 18 26 20 44C22 64 38 78 50 90C62 78 78 64 80 44C82 26 72 8 50 8z" fill="#38BDF8" stroke="#0369A1" stroke-width="3"/><ellipse cx="38" cy="30" rx="7" ry="12" fill="#fff" opacity=".5" transform="rotate(20 38 30)"/>',
       'cookie':'<circle cx="50" cy="52" r="38" fill="#F5C07A" stroke="#B45309" stroke-width="3"/><path d="M30 24Q38 18 46 22M72 34Q78 40 76 48" stroke="#fff" stroke-width="3" fill="none" opacity=".4" stroke-linecap="round"/>'+''.join(f'<ellipse cx="{x}" cy="{y}" rx="6" ry="5" fill="#5B2A0E" transform="rotate({r} {x} {y})"/>' for x,y,r in [(36,38,20),(62,32,-10),(70,58,30),(44,62,-20),(54,78,10),(28,62,40)]),
       'pizza':'<path d="M8 28Q50 8 92 28L50 94z" fill="#FDE68A" stroke="#B45309" stroke-width="3" stroke-linejoin="round"/><path d="M8 28Q50 8 92 28L88 36Q50 18 12 36z" fill="#F5C07A" stroke="#B45309" stroke-width="3" stroke-linejoin="round"/><circle cx="38" cy="46" r="6.5" fill="#EF4444"/><circle cx="62" cy="48" r="6.5" fill="#EF4444"/><circle cx="50" cy="68" r="6" fill="#EF4444"/><circle cx="50" cy="44" r="3" fill="#22C55E"/>'}
    return f'<svg width="{s}" height="{s}" viewBox="0 0 100 110" style="overflow:visible">{D[n]}</svg>'
# ---- props (extend) ----
_old=W.props
def props2(kind):
    if kind=='echo':
        return ''.join(f'<path d="{p}" fill="none" stroke="#F59E0B" stroke-width="6" stroke-linecap="round" opacity="{o}"/>' for p,o in [('M170 84q14 14 0 28',1),('M184 72q22 26 0 52',.75),('M198 60q30 40 0 76',.5),('M14 84q-14 14 0 28',1),('M0 72q-22 26 0 52',.75),('M-14 60q-30 40 0 76',.5)])
    if kind=='beats':
        return ('<path d="M44 6Q92 -34 140 6" fill="none" stroke="#F59E0B" stroke-width="3" stroke-dasharray="2 8" stroke-linecap="round"/>'+''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFD43B" stroke="#F59E0B" stroke-width="3.4"/><text x="{x}" y="{y+5}" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="{r+1}" fill="#8A5A00">{k}</text>' for k,(x,y,r) in enumerate([(48,4,11),(92,-14,13),(136,4,11)],1)))
    if kind=='turtle':
        return '<g transform="translate(150 204) scale(.46)">'+turtle(140).split('>',1)[1].rsplit('</svg>',1)[0]+'</g>'
    return _old(kind)
W.props=props2
def pao(pose,expr,h=300,prop=None): return W.pao(pose,expr,h,prop)
# ---- background ----
def pond():
    rip=''.join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{rx*.22:.0f}" fill="none" stroke="#fff" stroke-opacity=".38" stroke-width="3"/>' for x,y,rx in [(240,520,150),(1120,600,190),(700,820,260),(1300,790,140),(120,720,110),(900,470,110)])
    def pad(x,y,s,fl=False):
        f=f'<g transform="translate({x+s*.12:.0f} {y-s*.1:.0f})"><circle r="{s*.17:.0f}" cx="0" cy="0" fill="#F9A8D4"/><circle r="{s*.07:.0f}" fill="#FDE047"/></g>' if fl else ''
        return f'<g><ellipse cx="{x}" cy="{y}" rx="{s}" ry="{s*.3:.0f}" fill="#3FA55E"/><path d="M{x} {y}L{x+s} {y-s*.1:.0f}" stroke="#7FD6D0" stroke-width="{s*.16:.0f}"/><ellipse cx="{x}" cy="{y-3}" rx="{s*.92:.0f}" ry="{s*.24:.0f}" fill="#5FC77E"/></g>'+f
    reeds=''.join(f'<g transform="translate({x} 900)"><path d="M0 0Q{b} -{h/2:.0f} {b*1.4:.0f} -{h}" stroke="#2F8F55" stroke-width="7" fill="none" stroke-linecap="round"/><ellipse cx="{b*1.4:.0f}" cy="-{h+26}" rx="10" ry="30" fill="#8A5A2B" transform="rotate({b*.6:.0f} {b*1.4:.0f} -{h+26})"/></g>' for x,b,h in [(24,20,330),(66,10,270),(1410,-20,340),(1372,-8,260)])
    return (f'<div style="position:absolute;inset:0;background:linear-gradient(180deg,#A9E6EE 0%,#D6F6F1 36%,#E8FBF2 40%,#86DDD6 41%,#4FC1BF 100%)"></div>'
            f'<svg style="position:absolute;inset:0" width="1440" height="900"><path d="M0 356Q180 330 360 352T720 350T1080 352T1440 340V420H0z" fill="#CFF3E6"/><path d="M0 372Q240 352 480 372T960 370T1440 366V900H0z" fill="#79D8D2" opacity=".0"/>{rip}{pad(1180,520,70,True)}{pad(1320,690,56)}{pad(250,780,64,True)}{pad(1000,830,52)}{reeds}</svg>')
def clouds2():
    c=lambda x,y,k,o=1: f'<svg style="position:absolute;left:{x}px;top:{y}px;opacity:{o}" width="{140*k:.0f}" height="{70*k:.0f}" viewBox="0 0 140 70"><path d="M24 62a20 20 0 010-40 26 26 0 0148-8 22 22 0 0138 14 18 18 0 01-4 34z" fill="#fff"/></svg>'
    return c(1060,150,.9,.9)+c(1260,40,.6,.9)
def screen(inner,dim=False,h=900):
    return (f'<html><head><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0}}</style></head><body><div style="position:relative;width:1440px;height:{h}px;overflow:hidden;font-family:Inter;background:#A9E6EE">{pond()}{sun()}{clouds2()}{inner}'
            +('<div style="position:absolute;inset:0;background:rgba(10,50,60,.45)"></div>' if dim else '')+'</div></body></html>')
def back(t='All Games'):
    return f'<div style="position:absolute;left:28px;top:24px;height:46px;padding:0 18px;border-radius:15px;background:#fff;box-shadow:0 4px 0 #BFE0E0;display:flex;gap:8px;align-items:center;font-family:Poppins;font-weight:700;font-size:15px;color:#0F6B6B">{ico("back",18,"#0F6B6B",2.6)}{t}</div>'
def pv(): return f'<div style="height:28px;padding:0 14px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:6px;width:max-content">{ico("info",14,"#8A5A00",2.6)}Preview mode: scores are not saved</div>'
def topbar(done,cur,level='Level 1 · Slow',total=5):
    dots=''
    for i in range(total):
        if i<done: dots+=f'<div style="width:34px;height:34px;border-radius:50%;background:#22C55E;box-shadow:0 3px 0 #15803D;display:flex;align-items:center;justify-content:center">{ico("check",18,"#fff",3.4)}</div>'
        elif i==cur: dots+=f'<div style="width:40px;height:40px;border-radius:50%;background:#FFB020;box-shadow:0 0 0 5px rgba(255,176,32,.35),0 3px 0 #B97A00;display:flex;align-items:center;justify-content:center;font-family:Poppins;font-weight:800;color:#3B2400;font-size:17px">{i+1}</div>'
        else: dots+='<div style="width:34px;height:34px;border-radius:50%;background:#E6F6F5;border:2px solid #BFE3E1"></div>'
    return (back()+f'<div style="position:absolute;left:50%;top:20px;transform:translateX(-50%)"><div style="display:flex;align-items:center;gap:10px;height:58px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #BFE0E0"><span style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#5B8A8A;margin-right:4px">WORD</span>{dots}</div><div style="margin:8px auto 0;width:max-content">{pv()}</div></div>'
            f'<div style="position:absolute;right:28px;top:24px;height:50px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #BFE0E0;display:flex;gap:10px;align-items:center;font-family:Poppins;font-weight:700;font-size:16px;color:#0F6B6B">{turtle(34)}{level}</div>')
def chip(t,state='idle',w=170):
    st={'idle':'background:rgba(255,255,255,.95);border:4px solid #CFE8E8;color:#2A5B5B;box-shadow:0 7px 0 #CFE8E8;','active':'background:#FFE9A3;border:4px solid #F5B82E;color:#5C3B00;box-shadow:0 7px 0 #D59A12,0 0 0 8px rgba(255,190,60,.3);transform:scale(1.07);','done':'background:#D9F8E4;border:4px solid #22C55E;color:#14532D;box-shadow:0 7px 0 #15803D;','retry':'background:#FFEBD2;border:4px solid #FB923C;color:#7C2D12;box-shadow:0 7px 0 #C2570C;','ghost':'background:rgba(255,255,255,.55);border:4px dashed #9CCFCF;color:#6A9A9A;'}[state]
    mk=ico('check',22,'#16A34A',3.6) if state=='done' else ''
    return f'<div style="position:relative;min-width:{w}px;height:104px;padding:0 28px;border-radius:30px;display:flex;align-items:center;justify-content:center;gap:8px;font-family:Poppins;font-weight:800;font-size:56px;{st}">{t}<div style="position:absolute;right:10px;top:8px">{mk}</div></div>'
def wave(n=18,hs=None,color='#14B8A6',w=240,h=44):
    hs=hs or [10,22,34,18,38,26,14,30,40,20,32,16,36,24,12,28,18,8]
    bars=''.join(f'<rect x="{i*(w/n):.1f}" y="{(h-v)/2:.1f}" width="{w/n*.56:.1f}" height="{v}" rx="{w/n*.28:.1f}" fill="{color}"/>' for i,v in enumerate(hs[:n]))
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">{bars}</svg>'
def stage(word,syls,states,line,center,btns,pic_bg='#FFE9D6',pichint=None,card_h=540):
    chips=''
    for i,(s,st) in enumerate(zip(syls,states)):
        chips+=chip(s,st)
        if i<len(syls)-1: chips+='<div style="width:16px;height:16px;border-radius:50%;background:#9CCFCF"></div>'
    return (f'<div style="position:absolute;left:340px;top:130px;width:760px;height:{card_h}px;{CARD}padding:24px 30px;text-align:center"><div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#5B8A8A">{line}</div>'
            f'<div style="width:190px;height:190px;border-radius:50%;background:{pic_bg};margin:14px auto 10px;display:flex;align-items:center;justify-content:center">{pic(word,134)}</div>'
            f'<div style="display:flex;gap:16px;justify-content:center;align-items:center">{chips}</div>{center}<div style="display:flex;gap:14px;justify-content:center;margin-top:16px">{btns}</div></div>')
def btn(t,ic,kind='white',w=None):
    st={'white':'background:#fff;border:3px solid #BFE3E1;color:#0F6B6B;box-shadow:0 5px 0 #BFE0E0;','green':'background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;box-shadow:0 5px 0 #0F7A37;','orange':'background:linear-gradient(180deg,#FBBF24,#F59E0B);color:#fff;box-shadow:0 5px 0 #B97A00;','teal':'background:linear-gradient(180deg,#2DD4BF,#0D9488);color:#fff;box-shadow:0 5px 0 #0B6F66;'}[kind]
    c='#0F6B6B' if kind=='white' else '#fff'
    return f'<div style="height:60px;padding:0 30px;border-radius:19px;display:flex;gap:10px;align-items:center;justify-content:center;font-family:Poppins;font-weight:800;font-size:19px;white-space:nowrap;{st}{"width:%dpx;"%w if w else ""}">{ico(ic,24,c,2.6) if ic else ""}{t}</div>'
def pao_corner(pose,expr,say,prop=None):
    return (f'<div style="position:absolute;left:34px;bottom:0">{pao(pose,expr,300,prop)}</div>'
            f'<div style="position:absolute;left:260px;bottom:104px;max-width:420px"><div style="position:relative;background:#fff;border-radius:20px;padding:14px 20px;font-weight:700;font-size:18px;line-height:1.35;color:#14306B;box-shadow:0 5px 0 rgba(10,70,90,.25)">{say}<div style="position:absolute;left:-9px;bottom:26px;width:18px;height:18px;background:#fff;transform:rotate(45deg)"></div></div></div>')
# ---------- screens ----------
def setup():
    lv=[('Level 1','2-syllable words','pen·cil',1),('Level 2','3-syllable words','but·ter·fly',2),('Level 3','Tricky consonant blends','spl·ash',3),('Level 4','Short phrases','big red ball',4)]
    cards=''
    for i,(n,d,ex,k) in enumerate(lv):
        sel=i==0
        st='background:#E3FBF4;border:3px solid #14B8A6;box-shadow:0 5px 0 #0D9488;' if sel else 'background:#fff;border:3px solid #D3E8E8;box-shadow:0 5px 0 #D3E8E8;'
        dots=''.join(f'<div style="width:10px;height:10px;border-radius:50%;background:{"#14B8A6" if j<k else "#D3E8E8"}"></div>' for j in range(4))
        cards+=(f'<div style="height:96px;border-radius:22px;padding:12px 16px;display:flex;align-items:center;gap:14px;{st}position:relative"><div style="width:48px;height:48px;border-radius:15px;background:{"#14B8A6" if sel else "#9CCFCF"};display:flex;align-items:center;justify-content:center;font-family:Poppins;font-weight:800;font-size:24px;color:#fff;flex:none">{i+1}</div>'
                f'<div style="flex:1;min-width:0;text-align:left"><div style="font-family:Poppins;font-weight:800;font-size:18px;color:#0F4F4F">{n}</div><div style="font-size:13px;font-weight:600;color:#4B7B7B">{d}</div><div style="font-size:13px;font-weight:800;color:#0D9488;margin-top:2px">{ex}</div></div><div style="display:flex;flex-direction:column;gap:3px">{dots}</div>'+(f'<div style="position:absolute;right:-8px;top:-8px;width:28px;height:28px;border-radius:50%;background:#14B8A6;border:3px solid #fff;display:flex;align-items:center;justify-content:center">{ico("check",14,"#fff",3.6)}</div>' if sel else '')+'</div>')
    pace=''
    for i,(n,sp) in enumerate([('Slow',3),('Slower',2),('Turtle-speed',1)]):
        sel=i==0
        bars=''.join(f'<div style="width:{10+j*6}px;height:5px;border-radius:3px;background:{"#fff" if sel else "#9CCFCF"}"></div>' for j in range(sp))
        pace+=f'<div style="flex:1;height:62px;border-radius:20px;display:flex;align-items:center;justify-content:center;gap:10px;font-family:Poppins;font-weight:800;font-size:17px;{"background:linear-gradient(180deg,#2DD4BF,#0D9488);color:#fff;box-shadow:0 4px 0 #0B6F66" if sel else "background:#fff;border:3px solid #D3E8E8;color:#0F6B6B;box-shadow:0 4px 0 #D3E8E8"}">{turtle(34)}{n}<div style="display:flex;flex-direction:column;gap:3px">{bars}</div></div>'
    toggle=(f'<div style="height:80px;border-radius:22px;background:#F3FAFA;border:3px solid #D3E8E8;display:flex;align-items:center;gap:16px;padding:0 20px"><div style="width:48px;height:48px;border-radius:15px;background:#FFE9A3;display:flex;align-items:center;justify-content:center">{ico("spk",26,"#8A5A00",2.4)}</div><div style="flex:1;text-align:left"><div style="font-family:Poppins;font-weight:800;font-size:18px;color:#0F4F4F">Echo one syllable at a time</div><div style="font-size:13.5px;color:#4B7B7B;font-weight:600">Turn off when your child is ready to echo the whole word.</div></div>'
            f'<div style="width:68px;height:38px;border-radius:19px;background:#14B8A6;padding:4px;display:flex;justify-content:flex-end;box-shadow:inset 0 2px 0 rgba(0,0,0,.15)"><div style="width:30px;height:30px;border-radius:50%;background:#fff;box-shadow:0 2px 0 rgba(0,0,0,.2)"></div></div></div>')
    card=(f'<div style="position:absolute;left:50%;top:84px;transform:translateX(-50%);width:780px;{CARD}padding:24px 34px 26px;text-align:center"><div style="display:flex;justify-content:center">{turtle(100)}</div><div style="font-family:Poppins;font-weight:800;font-size:44px;color:#0F4F4F;line-height:1.1;margin-top:6px">Slow-Motion Echo</div>'
          f'<div style="font-size:16.5px;line-height:1.45;color:#4B7B7B;font-weight:600;margin:6px 40px 16px">Listen to each word broken into syllables, nice and slow. Then say it back. No rush!</div>'
          f'<div style="text-align:left;font-size:12.5px;font-weight:800;letter-spacing:.14em;color:#5B8A8A;margin-bottom:8px">CHOOSE A LEVEL</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">{cards}</div>'
          f'<div style="text-align:left;font-size:12.5px;font-weight:800;letter-spacing:.14em;color:#5B8A8A;margin:16px 0 8px">PACING</div><div style="display:flex;gap:12px">{pace}</div><div style="margin-top:16px">{toggle}</div>'
          f'<div style="margin-top:16px;height:64px;border-radius:20px;background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;font-family:Poppins;font-weight:800;font-size:24px;display:flex;gap:12px;align-items:center;justify-content:center;box-shadow:0 5px 0 #0F7A37">{ico("play",28,"#fff",2.2)}Let us go!</div></div>')
    return screen(back()+f'<div style="position:absolute;left:50%;top:16px;transform:translateX(-50%)">{pv()}</div>'+card+pao_corner('hello','happy','Ready to echo? Let us go nice and slow!').replace('left:260px;bottom:104px;max-width:420px','left:40px;bottom:322px;width:270px').replace('left:-9px;bottom:26px','left:90px;bottom:-9px'))
def listen():
    c=f'<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;height:50px"><div style="height:44px;padding:0 18px;border-radius:999px;background:#E3FBF4;color:#0D9488;font-weight:800;font-size:15px;display:flex;align-items:center;gap:10px">Now hearing{wave(14,None,"#14B8A6",150,32)}<span style="font-family:Poppins;font-size:20px;color:#0F4F4F">cil</span></div></div>'
    return screen(topbar(0,0)+stage('pencil',['pen','cil'],['done','active'],'WORD 1 OF 5',c,btn('Replay','redo','white')+btn('Slower','turtle','white'),)+pao_corner('relax','happy','Listen closely. Here comes the word!','phones'))
def yourturn():
    c=(f'<div style="display:flex;align-items:center;justify-content:center;gap:14px;margin-top:16px;height:50px"><div style="height:44px;padding:0 20px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:16px;display:flex;align-items:center;gap:10px">{ico("mic",22,"#8A5A00",2.4)}Your turn! Say <b style="font-family:Poppins;font-size:20px">cil</b></div></div>')
    return screen(topbar(0,0)+stage('pencil',['pen','cil'],['done','active'],'WORD 1 OF 5',c,btn('Hear it again','spk','white')+btn('I said it!','check','green'))+pao_corner('relax','surprised','Your turn! Say it back, nice and slow.','echo'))
def great():
    c=f'<div style="font-family:Poppins;font-weight:800;font-size:34px;color:#15803D;margin-top:14px;display:flex;align-items:center;justify-content:center;gap:12px"><svg width="34" height="34">{star(17,18,14)}</svg>Pen-cil! Great echo!</div>'
    burst=''.join(f'<div style="position:absolute;left:{360+380+400*math.cos(a):.0f}px;top:{130+250+250*math.sin(a):.0f}px"><svg width="30" height="30">{star(15,16,12,["#FFD43B","#F472B6","#38BDF8","#4ADE80"][k%4],"#fff")}</svg></div>' for k,a in enumerate([i*math.pi/5+.2 for i in range(10)]))
    return screen(topbar(1,1)+stage('pencil',['pen','cil'],['done','done'],'WORD 1 OF 5',c,btn('Hear it again','spk','white')+btn('Next word','arrow','green'),pic_bg='#DDF7E5')+burst.replace('left:740px','left:740px')+pao_corner('cheer','excited','Yes! Pen-cil! What a super echo!'))
def slower():
    c=f'<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px"><div style="height:46px;padding:0 20px;border-radius:999px;background:#FFEBD2;color:#9A3412;font-weight:800;font-size:16px;display:flex;align-items:center;gap:10px">{turtle(34)}Let us try that again, even slower</div></div>'
    return screen(topbar(0,0,'Level 1 · Slower')+stage('pencil',['pen','cil'],['done','retry'],'TRY AGAIN',c,btn('Hear it slower','turtle','orange')+btn('Skip word','arrow','white'),pic_bg='#FFEBD2')+pao_corner('relax','happy','Almost! Turtles go slowly. Let us try again.','turtle'))
def results():
    words=[('pencil','pen·cil',0),('balloon','bal·loon',0),('cookie','cook·ie',1),('pizza','piz·za',0),('apple','ap·ple',0)]
    ch=''.join(f'<div style="flex:1;border-radius:18px;background:#F3FAFA;border:2px solid #D3E8E8;padding:10px 4px 8px;text-align:center;position:relative"><div style="display:flex;justify-content:center">{pic(w,54)}</div><div style="font-weight:800;font-size:14px;color:#0F4F4F;margin-top:2px">{s}</div><div style="position:absolute;right:6px;top:6px;width:22px;height:22px;border-radius:50%;background:{"#F59E0B" if h else "#22C55E"};display:flex;align-items:center;justify-content:center">{ico("turtle" if h else "check",13,"#fff",3)}</div></div>' for w,s,h in words)
    def stat(l,v,ic,c): return f'<div style="flex:1;border-radius:18px;background:#EAF8F6;padding:14px 8px;text-align:center"><div style="width:40px;height:40px;margin:0 auto 6px;border-radius:13px;background:{c};display:flex;align-items:center;justify-content:center">{ico(ic,22,"#fff",2.4)}</div><div style="font-family:Poppins;font-weight:800;font-size:26px;color:#0F4F4F;line-height:1">{v}</div><div style="font-size:12.5px;color:#4B7B7B;font-weight:700;margin-top:3px">{l}</div></div>'
    sts=''.join('<svg width=%d height=%d viewBox="0 0 70 70">%s</svg>'%(s,s,star(35,37,30)) for s in (80,104,80))
    m=(f'<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:860px;{CARD}padding:28px 36px 26px;text-align:center"><div style="font-family:Poppins;font-weight:800;font-size:38px;color:#0F4F4F;line-height:1.1">You echoed all 5 words!</div><div style="font-size:16px;color:#4B7B7B;font-weight:600;margin-top:4px">Pao says: "Slow and steady. Super echoing, Rene!"</div>'
       f'<div style="display:flex;justify-content:center;align-items:flex-end;gap:26px;margin:6px 0 4px"><div style="width:190px;height:215px;overflow:hidden;border-radius:26px;background:linear-gradient(180deg,#D6F6F1,#9DE3DC);display:flex;align-items:flex-end;justify-content:center">{pao("tada","proud",250)}</div><div style="display:flex;gap:6px;align-items:flex-end;padding-bottom:30px">{sts}</div></div>'
       f'<div style="display:flex;gap:12px">{stat("First try","4 of 5","check","#22C55E")}{stat("Slower tries","1","turtle","#F59E0B")}{stat("Replays","3","redo","#14B8A6")}{stat("Pace","Slow","clock","#6366F1")}</div><div style="display:flex;gap:10px;margin-top:14px">{ch}</div>'
       f'<div style="margin-top:14px;border-radius:18px;background:#E3FBF4;border:2px solid #9BE3D3;padding:12px 16px;display:flex;align-items:center;gap:14px;text-align:left"><div style="width:44px;height:44px;border-radius:14px;background:#14B8A6;display:flex;align-items:center;justify-content:center">{ico("level",24,"#fff",2.4)}</div><div style="flex:1"><div style="font-weight:800;color:#0F4F4F;font-size:15px">Ready for Level 2?</div><div style="font-size:13px;color:#4B7B7B;font-weight:600">3-syllable words like but·ter·fly</div></div><div style="font-weight:800;color:#0D9488;font-size:14px">You echoed 4 of 5 on the first try</div></div>'
       f'<div style="display:flex;gap:12px;margin-top:18px"><div style="flex:1.2;height:58px;border-radius:17px;background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #0F7A37">{ico("redo",22,"#fff",2.4)}Play again</div><div style="flex:1.2;height:58px;border-radius:17px;background:#E3FBF4;color:#0D9488;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #B9ECE0">{ico("level",22,"#0D9488",2.4)}Try Level 2</div><div style="flex:1;height:58px;border-radius:17px;background:#fff;border:3px solid #D3E8E8;color:#0F6B6B;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center">{ico("home",22,"#0F6B6B",2.4)}All games</div></div><div style="margin-top:12px;font-size:12.5px;color:#6B8F8F;font-weight:700">Preview mode: this score was not saved</div></div>')
    return screen(back()+m,dim=True)
REACT=[('Ready','hello','happy',None,'Game starts','Let us echo some words!','Waves, head tilts'),
 ('Listening','relax','happy','phones','Word is being spoken','Listen closely...','Headphones, sound waves pulse'),
 ('Your turn','relax','surprised','echo','Echo prompt appears','Your turn! Say it back.','Mouth opens, echo rings pulse'),
 ('Syllable beats','groove','happy','beats','Each syllable plays','pen... cil...','Body rocks, beat dots light up'),
 ('Great echo','cheer','excited',None,'Word echoed','Yes! What a super echo!','Arms pump, stars twinkle'),
 ('Go slower','relax','happy','turtle','Needs another try','Turtles go slowly. Try again!','Turtle walks in, calm sway'),
 ('Streak','jump','laugh',None,'3 first-try echoes','Wow! 3 in a row!','Leap and land, shadow shrinks'),
 ('All done','tada','proud',None,'Last word finished','Slow and steady. You did it!','Arms open, sparkles')]
def board():
    cards=''
    for n,po,ex,pr,trig,line,mo in REACT:
        cards+=(f'<div style="{CARD}padding:14px 16px 16px;display:flex;flex-direction:column;align-items:center"><div style="width:100%;height:215px;border-radius:22px;background:linear-gradient(180deg,#D6F6F1,#EAFBF6 60%,#8FE0C0 61%,#5FCFA0);display:flex;align-items:center;justify-content:center;overflow:hidden">{pao(po,ex,205,pr)}</div>'
                f'<div style="font-family:Poppins;font-weight:800;font-size:22px;color:#0F4F4F;margin-top:10px">{n}</div><div style="font-size:12.5px;font-weight:700;color:#6B8F8F;margin-top:2px;text-align:center">{trig}</div>'
                f'<div style="font-size:14px;font-weight:700;color:#0F4F4F;background:#F3FAFA;border-radius:12px;padding:7px 10px;margin-top:8px;text-align:center;width:100%">"{line}"</div>'
                f'<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;justify-content:center"><span style="height:26px;padding:0 10px;border-radius:999px;background:#E3FBF4;color:#0D9488;font-weight:800;font-size:12px;display:flex;align-items:center">Pose: {po}</span><span style="height:26px;padding:0 10px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12px;display:flex;align-items:center">Face: {ex}</span></div><div style="font-size:11.5px;color:#6B8F8F;font-weight:600;margin-top:7px;text-align:center">{mo}</div></div>')
    return (f'<html><head><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0}}</style></head><body><div style="position:relative;width:1440px;height:1000px;overflow:hidden;font-family:Inter;background:linear-gradient(180deg,#8FDDE6 0%,#C8F3EE 60%,#E4FBF4 100%)"><div style="position:absolute;left:0;right:0;top:26px;text-align:center"><div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#0F6B6B">SLOW-MOTION ECHO</div><div style="font-family:Poppins;font-weight:800;font-size:36px;color:#0F4F4F">Pao reactions for this game</div></div><div style="position:absolute;left:50%;top:104px;transform:translateX(-50%);width:1320px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">{cards}</div></div></body></html>')
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1.25)
        def shot(n,h):
            pg.set_content(h); pg.wait_for_timeout(300)
            pg.evaluate("t=>document.querySelectorAll('svg').forEach(s=>s.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t}))",450)
            pg.screenshot(path=f'/home/claude/pngs/{n}.png')
        shot('264-echo-setup',setup()); shot('265-echo-listen',listen()); shot('266-echo-your-turn',yourturn()); shot('267-echo-great',great()); shot('268-echo-try-slower',slower()); shot('269-echo-results',results())
        pg.set_viewport_size({'width':1440,'height':1000}); shot('270-echo-pao-reactions',board())
        b.close()
