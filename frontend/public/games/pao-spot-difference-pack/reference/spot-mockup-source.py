import sys, math; sys.path.insert(0,'/home/claude/pao2')
import pword as W
import costumes as C
from pword import ico, IC, star, CARD, LOOK
from playwright.sync_api import sync_playwright
C.install(W,'spot-difference')
IC.update({'lens':'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>'})

# ---------------- the bedroom scene ----------------
# viewBox 640x400. Four differences (centre x, centre y, ring radius):
DIFFS={'sock':(310,340,36,'Blue sock'),'lamp':(334,202,44,'Lamp colour'),'book':(300,138,32,'Extra book'),'sun':(158,78,26,'Sun in the picture')}
def scene_svg(side,found=(),hint=None,miss=None,uid='a'):
    A=side=='A'
    lamp='#F59E0B' if A else '#E5484D'
    lampd='#B45309' if A else '#9F1239'
    o=f'<clipPath id="c{uid}"><rect width="640" height="400" rx="26"/></clipPath><g clip-path="url(#c{uid})">'
    o+='<rect width="640" height="300" fill="#FDEBD6"/><rect y="300" width="640" height="100" fill="#D9B88E"/><rect y="294" width="640" height="10" fill="#C9A173"/>'
    # picture frame
    o+='<rect x="80" y="54" width="100" height="76" rx="6" fill="#B9784A"/><rect x="87" y="61" width="86" height="62" rx="2" fill="#EAF7E4"/><path d="M87 123L112 92L130 108L146 90L173 123z" fill="#7BC74D"/>'
    if A: o+='<circle cx="158" cy="78" r="8" fill="#FFC83D"/>'
    # shelf and books
    o+='<rect x="226" y="158" width="150" height="9" rx="3" fill="#8A5535"/><rect x="238" y="116" width="16" height="42" rx="2" fill="#3B82F6"/><rect x="256" y="120" width="16" height="38" rx="2" fill="#EF4444"/><rect x="274" y="118" width="16" height="40" rx="2" fill="#22A559"/>'
    if not A: o+='<rect x="292" y="114" width="16" height="44" rx="2" fill="#8B5CF6"/>'
    o+='<path d="M334 158a14 14 0 0 1 28 0z" fill="#F59E0B"/>'
    # window
    o+='<rect x="452" y="54" width="158" height="110" rx="10" fill="#fff"/>'+''.join(f'<rect x="{x}" y="{y}" width="68" height="{h}" rx="3" fill="#BFE4F8"/>' for x,y,h in [(460,62,46),(534,62,46),(460,114,42),(534,114,42)])+'<circle cx="568" cy="88" r="20" fill="#FFC045"/>'
    # nightstand + lamp
    o+=f'<rect x="300" y="246" width="70" height="52" rx="5" fill="#C48C57"/><rect x="300" y="246" width="70" height="8" rx="4" fill="#D9A56E"/><rect x="331" y="218" width="6" height="28" fill="#6B7280"/><polygon points="312,218 356,218 346,186 322,186" fill="{lamp}"/><rect x="322" y="186" width="24" height="5" rx="2" fill="{lampd}" opacity=".35"/>'
    # bed
    o+='<rect x="34" y="240" width="26" height="130" rx="7" fill="#8B5A3C"/><rect x="56" y="290" width="144" height="50" rx="9" fill="#fff"/><rect x="118" y="292" width="160" height="44" rx="11" fill="#9B72E0"/><rect x="62" y="272" width="62" height="24" rx="12" fill="#fff" stroke="#D9DEE8" stroke-width="2"/><rect x="262" y="334" width="16" height="36" rx="3" fill="#8B5A3C"/>'
    # rug, cat, ball
    o+='<ellipse cx="430" cy="352" rx="120" ry="28" fill="#F1A9C0"/><path d="M360 352H500" stroke="#F8D0DC" stroke-width="5" stroke-linecap="round"/>'
    o+='<path d="M390 342q-24 -2 -22 -22q2 -8 10 -4" stroke="#F28A2E" stroke-width="9" fill="none" stroke-linecap="round"/><ellipse cx="424" cy="344" rx="40" ry="19" fill="#F28A2E"/><circle cx="470" cy="330" r="18" fill="#F28A2E"/><polygon points="458,320 462,298 474,314" fill="#F28A2E"/><polygon points="476,314 488,298 490,322" fill="#F28A2E"/><circle cx="465" cy="330" r="2.4" fill="#5B2A0E"/><circle cx="477" cy="330" r="2.4" fill="#5B2A0E"/>'
    o+='<circle cx="578" cy="358" r="27" fill="#E8484F"/><path d="M553 354Q578 340 603 354" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M553 364Q578 376 603 364" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>'
    if A: o+='<g transform="translate(72 0)"><path d="M214 310h24v26q14 4 20 14q4 12 -8 12h-36z" fill="#3B82F6" stroke="#2563EB" stroke-width="2.5" stroke-linejoin="round"/><rect x="214" y="310" width="24" height="9" fill="#93C5FD"/></g>'
    # hint spotlight
    if hint:
        cx,cy,r=DIFFS[hint][:3]
        o+=(f'<defs><mask id="m{uid}"><rect width="640" height="400" fill="#fff"/><circle cx="{cx}" cy="{cy}" r="{r+10}" fill="#000"/></mask></defs><rect width="640" height="400" fill="#1B2B6B" opacity=".42" mask="url(#m{uid})"/>'
            f'<circle cx="{cx}" cy="{cy}" r="{r+18}" fill="none" stroke="#FFD43B" stroke-width="5" opacity=".45"/><circle cx="{cx}" cy="{cy}" r="{r+10}" fill="none" stroke="#FFB020" stroke-width="6" stroke-dasharray="3 12" stroke-linecap="round"/>')
    for k in found:
        cx,cy,r=DIFFS[k][:3]
        o+=(f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="rgba(34,197,94,.14)" stroke="#fff" stroke-width="11"/><circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="#22C55E" stroke-width="6"/>'
            f'<g transform="translate({cx+r*.72:.0f} {cy-r*.72:.0f})"><circle r="15" fill="#22C55E" stroke="#fff" stroke-width="4"/><path d="M-6 0L-2 5L7 -5" stroke="#fff" stroke-width="3.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>')
    if miss:
        x,y=miss
        o+=(f'<circle cx="{x}" cy="{y}" r="30" fill="rgba(251,146,60,.18)" stroke="#fff" stroke-width="10"/><circle cx="{x}" cy="{y}" r="30" fill="none" stroke="#FB923C" stroke-width="5" stroke-dasharray="8 7" stroke-linecap="round"/><circle cx="{x}" cy="{y}" r="6" fill="#FB923C"/>')
    o+='</g>'
    return f'<svg viewBox="0 0 640 400" width="100%" height="100%" style="display:block">{o}</svg>'
def crop(side,k,w=118,h=90):
    cx,cy,r=DIFFS[k][:3]
    inner=scene_svg(side,uid='z'+k).replace('viewBox="0 0 640 400" width="100%" height="100%"',f'viewBox="{cx-52} {cy-40} 104 80" width="{w}" height="{h}"')
    return inner

# ---------------- layout pieces ----------------
CW,CH=620,388
def pcard(x,side,label,**kw):
    return (f'<div style="position:absolute;left:{x}px;top:206px;width:{CW}px;height:{CH}px;{CARD}padding:8px;border-radius:34px;box-shadow:0 8px 0 rgba(30,80,150,.16),0 18px 40px rgba(24,70,130,.18)"><div style="width:100%;height:100%;border-radius:26px;overflow:hidden">{scene_svg(side,uid=side+label,**kw)}</div></div>'
            f'<div style="position:absolute;left:{x+CW/2-62}px;top:174px;width:124px;height:38px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #C4D9F2;font-family:Poppins;font-weight:800;font-size:16px;color:#1B2B6B;display:flex;align-items:center;justify-content:center;gap:8px"><span style="width:22px;height:22px;border-radius:50%;background:{"#6366F1" if side=="A" else "#EC4899"};color:#fff;font-size:13px;display:flex;align-items:center;justify-content:center">{side}</span>Picture {side}</div>')
def pv(): return f'<div style="height:28px;padding:0 14px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:6px;width:max-content;margin:8px auto 0;box-shadow:0 3px 0 #EBCB74">{ico("info",14,"#8A5A00",2.6)}Preview mode: scores are not saved</div>'
def header(stars=0):
    chip='<span style="height:26px;padding:0 12px;border-radius:999px;background:#EDE9FE;color:#5B3FD0;font-weight:800;font-size:13px;display:flex;align-items:center;gap:6px">Hard'+''.join('<i style="width:6px;height:6px;border-radius:50%;background:#7C5CE0;display:block"></i>' for _ in range(3))+'</span>'
    return (W.back().replace('>Back<','>Games<').replace('</svg>Back','</svg>Games')+
            f'<div style="position:absolute;left:50%;top:18px;transform:translateX(-50%)"><div style="display:flex;align-items:center;gap:14px;height:58px;padding:0 22px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #C4D9F2;white-space:nowrap"><span style="font-family:Poppins;font-weight:800;font-size:22px;color:#1B1250">Spot the Differences</span><span style="width:2px;height:24px;background:#E0E7F5"></span><span style="font-weight:800;font-size:14.5px;color:#5B3FD0">Pao\'s bedroom</span>{chip}</div>{pv()}</div>'+W.stars_pill(stars))
def headline(t,color='#1B2B6B',sub=None):
    return f'<div style="position:absolute;left:0;right:0;top:122px;text-align:center;font-family:Poppins;font-weight:800;font-size:32px;color:{color};text-shadow:0 2px 0 rgba(255,255,255,.75);display:flex;align-items:center;justify-content:center;gap:12px">{sub or ""}{t}</div>'
def tracker(n,help_state='ready'):
    dots=''.join((f'<div style="width:30px;height:30px;border-radius:50%;background:#22C55E;box-shadow:0 3px 0 #15803D;display:flex;align-items:center;justify-content:center">{ico("check",17,"#fff",3.6)}</div>' if i<n else '<div style="width:30px;height:30px;border-radius:50%;background:#E8F1FC;border:3px solid #CFE0F5"></div>') for i in range(4))
    hb={'ready':f'background:#FFF3C9;border:3px solid #F6C453;color:#8A5A00;box-shadow:0 5px 0 #E3A82A;','used':'background:#F1F5FB;border:3px solid #E3ECFA;color:#8A97AE;'}[help_state]
    lab='Help me' if help_state=='ready' else 'Hint used'
    ic='#8A5A00' if help_state=='ready' else '#8A97AE'
    return (f'<div style="position:absolute;left:50%;top:618px;transform:translateX(-50%);display:flex;gap:18px;align-items:center">'
            f'<div style="height:62px;padding:0 26px;border-radius:999px;background:#fff;box-shadow:0 5px 0 #C4D9F2;display:flex;gap:14px;align-items:center;font-family:Poppins;font-weight:800;font-size:19px;color:#1B2B6B;white-space:nowrap">Found {n} of 4<div style="display:flex;gap:8px">{dots}</div></div>'
            f'<div style="height:62px;padding:0 26px;border-radius:20px;display:flex;gap:10px;align-items:center;font-family:Poppins;font-weight:800;font-size:19px;white-space:nowrap;{hb}">{ico("lens",26,ic,2.6)}{lab}</div></div>')
def scr(inner,dim=False):
    return W.screen(inner,dim)
def pao_c(pose,expr,say,prop=None):
    return W.pao_corner(pose,expr,say,prop)
def tip(x,y,t,c='#9A3412',bg='#FFEBD2',bd='#FB923C'):
    return f'<div style="position:absolute;left:{x}px;top:{y}px;height:44px;padding:0 18px;border-radius:15px;background:{bg};border:3px solid {bd};color:{c};font-family:Poppins;font-weight:800;font-size:16px;display:flex;align-items:center;gap:8px;white-space:nowrap;box-shadow:0 4px 0 rgba(0,0,0,.12)">{t}</div>'
LX,RX=80,740
def burst(cx,cy,n=8,r=64):
    return ''.join(f'<div style="position:absolute;left:{cx+r*math.cos(a)-15:.0f}px;top:{cy+r*math.sin(a)-15:.0f}px"><svg width="30" height="30">{star(15,16,12,["#FFD43B","#F472B6","#38BDF8","#4ADE80"][k%4],"#fff")}</svg></div>' for k,a in enumerate([i*2*math.pi/n+.3 for i in range(n)]))
# map scene coords -> page coords (card inner starts at x+8, y 214; scale .9
S=(CW-16)/640
def pg(side,k):
    x=(LX if side=='A' else RX)+8; cx,cy,r=DIFFS[k][:3]
    return x+cx*S, 214+cy*S

# ---------------- screens ----------------
def play():
    return scr(header(0)+headline('Find all 4 differences')+pcard(LX,'A','a')+pcard(RX,'B','b')+tracker(0)+pao_c('hello','happy','Let us spot 4 differences. Tap what looks different!'))
def found():
    fa=['sock','lamp']
    bx,by=pg('B','lamp')
    return scr(header(2)+headline('You found the lamp!','#15803D',f'<svg width="38" height="38">{star(19,20,16)}</svg>')+pcard(LX,'A','a',found=fa)+pcard(RX,'B','b',found=fa)+burst(bx,by,8,74)+tracker(2)
               +pao_c('cheer','excited','Yes! The lamp is a different colour. Two to go!'))
def miss():
    x,y=470,150
    mx=RX+8+x*S; my=214+y*S
    return scr(header(1)+headline('Not quite. Try another spot')+pcard(LX,'A','a',found=['sock'])+pcard(RX,'B','b',found=['sock'],miss=(x,y))+tracker(1)
               +tip(mx-30,my+44,'Those two match')
               +pao_c('shy','silly','Oops! That part is the same in both pictures.'))
def hint():
    return scr(header(1)+headline('Clue: look at the bookshelf','#8A5A00')+pcard(LX,'A','a',found=['sock'],hint='book')+pcard(RX,'B','b',found=['sock'],hint='book')+tracker(1,'used')
               
               +pao_c('think','wink','Look near the bookshelf. Count the books!','lens'))
def results():
    names=[('sock','A'),('lamp','B'),('book','B'),('sun','A')]
    th=''.join(f'<div style="flex:1;border-radius:18px;background:#F3F7FF;border:2px solid #DCE6F8;padding:8px 8px 10px;text-align:center"><div style="border-radius:12px;overflow:hidden;display:flex;justify-content:center;border:2px solid #fff">{crop(sd,k,150,115)}</div><div style="font-weight:800;font-size:14px;color:#1B2B6B;margin-top:6px">{DIFFS[k][3]}</div></div>' for k,sd in names)
    sts=''.join('<svg width=%d height=%d viewBox="0 0 70 70">%s</svg>'%(s,s,star(35,37,30)) for s in (80,104,80))
    def stat(l,v,ic,c): return f'<div style="flex:1;border-radius:18px;background:#EEF3FF;padding:14px 8px;text-align:center"><div style="width:40px;height:40px;margin:0 auto 6px;border-radius:13px;background:{c};display:flex;align-items:center;justify-content:center">{ico(ic,22,"#fff",2.4)}</div><div style="font-family:Poppins;font-weight:800;font-size:26px;color:#1B1250;line-height:1">{v}</div><div style="font-size:12.5px;font-weight:700;color:#6B7A99;margin-top:4px">{l}</div></div>'
    m=(f'<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:880px;{CARD}padding:28px 36px 26px;text-align:center"><div style="font-family:Poppins;font-weight:800;font-size:38px;color:#1B1250;line-height:1.1">You spotted all 4 differences!</div><div style="font-size:16px;color:#5B6A89;font-weight:600;margin-top:4px">Pao says: "Super sharp eyes, Rene!"</div>'
       f'<div style="display:flex;justify-content:center;align-items:flex-end;gap:26px;margin:6px 0 4px"><div style="width:190px;height:215px;overflow:hidden;border-radius:26px;background:linear-gradient(180deg,#BFE6FB,#E6F6FF);display:flex;align-items:flex-end;justify-content:center">{W.pao("tada","proud",232)}</div><div style="display:flex;gap:6px;align-items:flex-end;padding-bottom:30px">{sts}</div></div>'
       f'<div style="display:flex;gap:12px">{stat("Found","4 of 4","check","#22C55E")}{stat("Time","1:42","clock","#6366F1")}{stat("Hints used","1","lens","#F59E0B")}{stat("Retries","2","redo","#FB923C")}</div>'
       f'<div style="text-align:left;font-size:12.5px;font-weight:800;letter-spacing:.14em;color:#7B8AA3;margin:16px 0 8px">WHAT YOU FOUND</div><div style="display:flex;gap:12px">{th}</div>'
       f'<div style="display:flex;gap:12px;margin-top:18px"><div style="flex:1.2;height:58px;border-radius:17px;background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #0F7A37">{ico("redo",22,"#fff",2.4)}Play again</div><div style="flex:1.2;height:58px;border-radius:17px;background:linear-gradient(180deg,#8B6BF0,#6B47E0);color:#fff;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #4B2BB8">Next picture{ico("arrow",22,"#fff",3)}</div><div style="flex:1;height:58px;border-radius:17px;background:#fff;border:3px solid #D3E1F8;color:#4B2BB8;font-family:Poppins;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 5px 0 #C4D5F2">All games</div></div></div>')
    return scr(W.back().replace('Back','Games')+m,dim=True)
REACT=[('Ready','hello','happy',None,'Picture appears','Let us spot 4 differences!','Waves, head tilts'),
 ('Found one','cheer','excited',None,'Correct tap','Yes! You found it!','Arms pump, stars pop'),
 ('One to go','lean','excited',None,'3 of 4 found','Just one more. You can do it!','Leans in, eyes wide'),
 ('Streak','jump','laugh',None,'3 finds with no misses','Wow! Super sharp eyes!','Leap and land, shadow shrinks'),
 ('Not quite','shy','silly',None,'Tap on a matching spot','Oops! Those two match.','Shy shrug, no red, no buzz'),
 ('Hint','think','wink','lens','Help me is tapped','Look near the bookshelf!','Magnifier sweeps, wink'),
 ('Encourage','hug','love',None,'3 wrong taps in a row','Take your time. I believe in you!','Hugs self, hearts in eyes'),
 ('All found','tada','proud',None,'4 of 4 found','You spotted them all!','Arms open, sparkles')]
def board():
    cards=''
    for n,po,ex,pr,trig,line,mo in REACT:
        cards+=(f'<div style="{CARD}padding:14px 16px 16px;display:flex;flex-direction:column;align-items:center"><div style="width:100%;height:215px;border-radius:22px;background:linear-gradient(180deg,#BFE6FB,#E6F6FF 60%,#A8E08A 61%,#7BCB6B);display:flex;align-items:center;justify-content:center;overflow:hidden">{W.pao(po,ex,205,pr)}</div>'
                f'<div style="font-family:Poppins;font-weight:800;font-size:22px;color:#1B1250;margin-top:10px">{n}</div><div style="font-size:12.5px;font-weight:700;color:#6B7A99;margin-top:2px;text-align:center">{trig}</div>'
                f'<div style="font-size:14px;font-weight:700;color:#1B2B6B;background:#EEF3FF;border-radius:12px;padding:7px 10px;margin-top:8px;text-align:center;width:100%">"{line}"</div>'
                f'<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;justify-content:center"><span style="height:26px;padding:0 10px;border-radius:999px;background:#EDE9FE;color:#5B3FD0;font-weight:800;font-size:12px;display:flex;align-items:center">Pose: {po}</span><span style="height:26px;padding:0 10px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12px;display:flex;align-items:center">Face: {ex}</span>'+(f'<span style="height:26px;padding:0 10px;border-radius:999px;background:#DDF7E5;color:#15803D;font-weight:800;font-size:12px;display:flex;align-items:center">Prop: {pr}</span>' if pr else '')+f'</div><div style="font-size:12px;font-weight:600;color:#6B7A99;margin-top:8px;text-align:center">{mo}</div></div>')
    return (f'<html><head><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0}}</style></head><body><div style="position:relative;width:1440px;height:1000px;overflow:hidden;font-family:Inter;background:linear-gradient(180deg,#5BB8F0 0%,#9AD8F8 55%,#D6F0FF 100%)"><div style="position:absolute;left:0;right:0;top:26px;text-align:center"><div style="font-size:13px;font-weight:800;letter-spacing:.16em;color:#fff">SPOT THE DIFFERENCE</div><div style="font-family:Poppins;font-weight:800;font-size:38px;color:#fff;text-shadow:0 3px 0 rgba(20,60,140,.3)">Pao reactions in Pajama Detective</div><div style="font-size:15px;font-weight:600;color:#EAF6FF;margin-top:2px">Eight reactions. Existing poses and faces only. In-game only, never saved, never changes Customize Pao.</div></div>'
            f'<div style="position:absolute;left:40px;right:40px;top:140px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">{cards}</div></div></body></html>')
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(); pg_=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1.25)
        def shot(n,h):
            pg_.set_content(h); pg_.wait_for_timeout(300)
            pg_.screenshot(path=f'/home/claude/pngs/{n}.png')
        shot('272-spot-difference-play',play()); shot('273-spot-difference-found',found()); shot('274-spot-difference-not-quite',miss()); shot('275-spot-difference-hint',hint()); shot('276-spot-difference-results',results())
        pg_.set_viewport_size({'width':1440,'height':1000}); shot('277-spot-difference-pao-reactions',board())
        b.close()
