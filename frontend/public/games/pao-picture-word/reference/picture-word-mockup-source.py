import sys, math; sys.path.insert(0,'/home/claude/pao2')
from hub import ico, IC, asvg, LOOK, sun, clouds, hills, medal
from anim_poses import psvg_a
from playwright.sync_api import sync_playwright
IC.update({'spk':'<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12"/>','search':'<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>','redo':'<path d="M3 12a9 9 0 109-9 9 9 0 00-7 3M3 4v5h5"/>','home':'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>','info':'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>','arrow':'<path d="M5 12h14M13 6l6 6-6 6"/>','clock':'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>','grid':'<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>'})
_g=[0]
def gid(): _g[0]+=1; return f'g{_g[0]}'
def star(x,y,r,fill='#FFD43B',st='#F59E0B'):
    pts=' '.join('%.1f,%.1f'%(x+(r if i%2==0 else r*.46)*math.sin(i*math.pi/5), y-(r if i%2==0 else r*.46)*math.cos(i*math.pi/5)) for i in range(10))
    return f'<polygon points="{pts}" fill="{fill}" stroke="{st}" stroke-width="2.2" stroke-linejoin="round"/>'
def ill(n,s=100):
    g=gid()
    D={
    'pineapple':f'<defs><linearGradient id="{g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FDE047"/><stop offset="1" stop-color="#F59E0B"/></linearGradient><clipPath id="{g}c"><ellipse cx="50" cy="66" rx="25" ry="32"/></clipPath></defs><path d="M50 36C38 22 33 12 39 2c6 8 11 18 11 34zM50 36C62 22 67 12 61 2c-6 8-11 18-11 34z" fill="#4ADE80"/><path d="M50 36C44 20 49 8 50 0c1 8 6 20 0 36z" fill="#16A34A"/><ellipse cx="50" cy="66" rx="25" ry="32" fill="url(#{g})" stroke="#D97706" stroke-width="2"/><g clip-path="url(#{g}c)" stroke="#B45309" stroke-opacity=".55" stroke-width="2.2">'+''.join(f'<path d="M{-10+k*16} 30 L{40+k*16} 110M{110-k*16} 30 L{60-k*16} 110"/>' for k in range(0,9))+'</g><ellipse cx="40" cy="52" rx="6" ry="12" fill="#fff" opacity=".4" transform="rotate(12 40 52)"/>',
    'grape':f'<path d="M50 28C50 18 54 12 62 10" stroke="#92400E" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M58 14C66 4 80 6 84 14C76 20 64 20 58 14z" fill="#4ADE80" stroke="#16A34A" stroke-width="1.6"/>'+''.join(f'<circle cx="{x}" cy="{y}" r="12" fill="#8B5CF6" stroke="#6D28D9" stroke-width="2"/><circle cx="{x-4}" cy="{y-4}" r="3.6" fill="#fff" opacity=".6"/>' for x,y in [(32,40),(50,38),(68,40),(40,56),(60,56),(50,72),(32,56)][:6]+[(50,88)]),
    'strawberry':f'<path d="M50 94C20 78 12 52 20 40C30 28 70 28 80 40C88 52 80 78 50 94z" fill="#F43F5E" stroke="#BE123C" stroke-width="2"/>'+''.join(f'<ellipse cx="{x}" cy="{y}" rx="2.2" ry="3.4" fill="#FDE68A"/>' for x,y in [(36,48),(50,46),(64,48),(30,62),(44,60),(58,60),(70,62),(40,74),(54,74),(50,86)])+'<path d="M50 34L38 22L46 30L44 16L52 28L58 16L58 30L68 22L58 36z" fill="#4ADE80" stroke="#16A34A" stroke-width="1.8" stroke-linejoin="round"/>',
    'apple':'<path d="M50 30C36 22 14 30 16 56C18 80 36 96 50 90C64 96 82 80 84 56C86 30 64 22 50 30z" fill="#EF4444" stroke="#B91C1C" stroke-width="2.4"/><path d="M50 28C50 18 54 12 58 8" stroke="#92400E" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M56 16C64 6 78 8 80 16C72 22 62 22 56 16z" fill="#4ADE80" stroke="#16A34A" stroke-width="1.6"/><ellipse cx="32" cy="52" rx="6" ry="12" fill="#fff" opacity=".4" transform="rotate(14 32 52)"/>',
    'carrot':'<path d="M50 28C44 14 36 8 30 6C40 4 48 12 50 24C52 12 60 4 70 6C64 8 56 14 50 28z" fill="#4ADE80" stroke="#16A34A" stroke-width="1.8"/><path d="M28 28Q50 20 72 28Q62 66 50 98Q38 66 28 28z" fill="#FB923C" stroke="#C2410C" stroke-width="2.4" stroke-linejoin="round"/><path d="M36 42h12M54 54h12M40 66h10M52 78h8" stroke="#C2410C" stroke-width="2.6" stroke-linecap="round" opacity=".7"/>',
    'cat':'<path d="M18 40L22 8L44 26zM82 40L78 8L56 26z" fill="#FB923C" stroke="#C2410C" stroke-width="2.4" stroke-linejoin="round"/><circle cx="50" cy="56" r="36" fill="#FDBA74" stroke="#C2410C" stroke-width="2.4"/><circle cx="36" cy="52" r="5" fill="#1B1250"/><circle cx="64" cy="52" r="5" fill="#1B1250"/><circle cx="37.6" cy="50.4" r="1.6" fill="#fff"/><circle cx="65.6" cy="50.4" r="1.6" fill="#fff"/><path d="M45 64L55 64L50 70z" fill="#F43F5E"/><path d="M50 70Q44 78 38 74M50 70Q56 78 62 74" stroke="#1B1250" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M16 62H30M16 70L30 66M84 62H70M84 70L70 66" stroke="#C2410C" stroke-width="2" stroke-linecap="round"/><circle cx="26" cy="64" r="6" fill="#FB7185" opacity=".35"/><circle cx="74" cy="64" r="6" fill="#FB7185" opacity=".35"/>',
    'ball':f'<defs><clipPath id="{g}c"><circle cx="50" cy="52" r="38"/></clipPath></defs><circle cx="50" cy="52" r="38" fill="#38BDF8" stroke="#0369A1" stroke-width="2.4"/><g clip-path="url(#{g}c)"><path d="M0 40Q50 70 100 30V0H0z" fill="#FDE047"/><path d="M0 70Q50 100 100 60V110H0z" fill="#F472B6"/><path d="M12 52Q50 76 88 52" fill="none" stroke="#fff" stroke-width="5"/></g><circle cx="50" cy="52" r="38" fill="none" stroke="#0369A1" stroke-width="2.4"/><ellipse cx="36" cy="34" rx="8" ry="5" fill="#fff" opacity=".6" transform="rotate(-30 36 34)"/>'}
    return f'<svg width="{s}" height="{s}" viewBox="0 0 100 100" style="overflow:visible">{D[n]}</svg>'
# ---------- Pao + props ----------
VB='-30 -66 250 322'
def props(kind):
    if kind=='phones':
        return ('<path d="M22 86C22 6 162 6 162 86" fill="none" stroke="#5B3FD0" stroke-width="11" stroke-linecap="round"/><path d="M22 86C22 8 162 8 162 86" fill="none" stroke="#9B7BFF" stroke-width="3" stroke-linecap="round" opacity=".7"/>'
                '<rect x="4" y="66" width="32" height="52" rx="15" fill="#7C5CE0" stroke="#4B2BB8" stroke-width="3"/><rect x="148" y="66" width="32" height="52" rx="15" fill="#7C5CE0" stroke="#4B2BB8" stroke-width="3"/>'
                '<rect x="9" y="74" width="9" height="36" rx="4" fill="#fff" opacity=".35"/><rect x="153" y="74" width="9" height="36" rx="4" fill="#fff" opacity=".35"/>'
                '<path d="M-6 80q-8 12 0 24M-16 72q-14 20 0 40" fill="none" stroke="#38BDF8" stroke-width="5" stroke-linecap="round"/><path d="M190 80q8 12 0 24M200 72q14 20 0 40" fill="none" stroke="#38BDF8" stroke-width="5" stroke-linecap="round"/>')
    if kind=='lens':
        return ('<g transform="translate(178 150) scale(.85)"><path d="M18 20L46 54" stroke="#92400E" stroke-width="11" stroke-linecap="round"/><path d="M18 20L46 54" stroke="#D97706" stroke-width="5" stroke-linecap="round"/><circle cx="0" cy="0" r="30" fill="#BAE6FD" fill-opacity=".55" stroke="#F59E0B" stroke-width="9"/><path d="M-16 -10a20 20 0 0 1 14 -14" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".85"/></g>'
                '<path d="M196 70l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" fill="#FFD43B"/>')
    return ''
def pao(pose,expr,h=240,prop=None,hat=None,t=450):
    look=dict(LOOK,hat=hat) if hat else dict(LOOK,hat=None)
    base=psvg_a(look,pose,expr,VB,None,h)
    w=h*250/322
    ov=f'<svg viewBox="{VB}" width="{w:.0f}" height="{h}" style="position:absolute;left:0;top:0;pointer-events:none">{props(prop)}</svg>' if prop else ''
    return f'<div style="position:relative;width:{w:.0f}px;height:{h}px">{base}{ov}</div>'
# ---------- screen ----------
def cl():
    c=lambda x,y,k,o=1: f'<svg style="position:absolute;left:{x}px;top:{y}px;opacity:{o}" width="{140*k:.0f}" height="{70*k:.0f}" viewBox="0 0 140 70"><path d="M24 62a20 20 0 010-40 26 26 0 0148-8 22 22 0 0138 14 18 18 0 01-4 34z" fill="#fff"/></svg>'
    return c(1080,16,1.0,.95)+c(80,420,.7,.85)+c(1290,640,.6,.8)
CARD='background:#fff;border:2px solid #fff;border-radius:30px;box-shadow:0 14px 40px rgba(24,70,130,.18);'
def screen(inner,dim=False):
    return (f'<html><head><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0}}</style></head><body><div style="position:relative;width:1440px;height:900px;overflow:hidden;font-family:Inter;background:linear-gradient(180deg,#5BB8F0 0%,#9AD8F8 55%,#D6F0FF 100%)">{sun()}{cl()}{hills()}{inner}'
            +('<div style="position:absolute;inset:0;background:rgba(20,40,90,.45)"></div>' if dim else '')+'</div></body></html>')
def back():
    return f'<div style="position:absolute;left:28px;top:24px;height:46px;padding:0 18px;border-radius:15px;background:#fff;box-shadow:0 4px 0 #C4D9F2;display:flex;gap:8px;align-items:center;font-family:Poppins;font-weight:700;font-size:15px;color:#4B2BB8">{ico("back",18,"#4B2BB8",2.6)}Back</div>'
def stars_pill(n):
    return f'<div style="position:absolute;right:28px;top:24px;height:50px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #C4D9F2;display:flex;gap:9px;align-items:center;font-family:Poppins;font-weight:800;font-size:20px;color:#8A5A00"><svg width="26" height="26">{star(13,14,11)}</svg>{n}</div>'
def progress(done,cur,total=6,preview=True,cat='Fruits'):
    dots=''
    for i in range(total):
        if i<done: dots+=f'<div style="width:34px;height:34px;border-radius:50%;background:#22C55E;box-shadow:0 3px 0 #15803D;display:flex;align-items:center;justify-content:center">{ico("check",18,"#fff",3.4)}</div>'
        elif i==cur: dots+=f'<div style="width:40px;height:40px;border-radius:50%;background:#FFB020;box-shadow:0 0 0 5px rgba(255,176,32,.35),0 3px 0 #B97A00;display:flex;align-items:center;justify-content:center;font-family:Poppins;font-weight:800;color:#3B2400;font-size:17px">{i+1}</div>'
        else: dots+='<div style="width:34px;height:34px;border-radius:50%;background:#E8F1FC;border:2px solid #CFE0F5"></div>'
    pv=f'<div style="margin:8px auto 0;width:max-content;height:28px;padding:0 14px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12.5px;display:flex;align-items:center;gap:6px">{ico("info",14,"#8A5A00",2.6)}Preview mode: scores are not saved</div>' if preview else ''
    return (f'<div style="position:absolute;left:50%;top:20px;transform:translateX(-50%)"><div style="display:flex;align-items:center;gap:10px;height:58px;padding:0 20px;border-radius:999px;background:#fff;box-shadow:0 4px 0 #C4D9F2"><span style="font-size:12px;font-weight:800;letter-spacing:.1em;color:#7B8AA3;margin-right:4px">{cat.upper()}</span>{dots}</div>{pv}</div>')
def picture_card(name,cat='Fruits',catc='#FDE2E4',catt='#BE123C',bg='#FFE3E6',hint=None,burst=False,ring=None):
    h=''
    if hint: h=f'<div style="position:absolute;left:50%;bottom:112px;transform:translateX(-50%);display:flex;align-items:center;gap:10px;height:54px;padding:0 20px 0 10px;border-radius:18px;background:#FFF3C9;border:3px solid #F6D774;box-shadow:0 4px 0 #E3B93C;font-weight:800;color:#8A5A00;font-size:17px;white-space:nowrap"><div style="width:38px;height:38px;border-radius:12px;background:#F59E0B;color:#fff;font-family:Poppins;font-size:24px;display:flex;align-items:center;justify-content:center">{hint}</div>It starts with {hint}</div>'
    b=''
    if burst:
        b=''.join(f'<div style="position:absolute;left:{50+43*math.cos(a):.1f}%;top:{39+43*math.sin(a):.1f}%;transform:translate(-50%,-50%)"><svg width="30" height="30">{star(15,16,12,["#FFD43B","#F472B6","#38BDF8","#4ADE80"][k%4],"#fff")}</svg></div>' for k,a in enumerate([i*math.pi/4+.3 for i in range(8)]))
    chk=f'<div style="position:absolute;right:112px;top:92px;width:76px;height:76px;border-radius:50%;background:#22C55E;border:5px solid #fff;box-shadow:0 6px 0 #15803D;display:flex;align-items:center;justify-content:center">{ico("check",44,"#fff",3.8)}</div>' if ring=='ok' else ''
    return (f'<div style="position:absolute;left:330px;top:150px;width:520px;height:520px;{CARD}"><div style="position:absolute;left:22px;top:22px;height:36px;padding:0 16px;border-radius:999px;background:{catc};color:{catt};font-weight:800;font-size:14px;display:flex;align-items:center">{cat}</div>'
            f'<div style="position:absolute;left:50%;top:70px;transform:translateX(-50%);width:320px;height:320px;border-radius:50%;background:{bg};display:flex;align-items:center;justify-content:center">{ill(name,230)}</div>{b}{chk}{h}'
            f'<div style="position:absolute;left:50%;bottom:26px;transform:translateX(-50%);height:62px;padding:0 34px;border-radius:20px;background:linear-gradient(180deg,#FBBF24,#F59E0B);color:#fff;font-family:Poppins;font-weight:800;font-size:21px;display:flex;gap:10px;align-items:center;box-shadow:0 5px 0 #B97A00;white-space:nowrap">{ico("spk",26,"#fff",2.4)}Hear it</div></div>')
def option(word,i,state='idle'):
    acc=['#6366F1','#F59E0B','#EC4899'][i]
    st={'idle':'background:#fff;border:3px solid #D3E1F8;box-shadow:0 6px 0 #C4D5F2;','ok':'background:#E3F8EA;border:3px solid #22C55E;box-shadow:0 6px 0 #15803D;','retry':'background:#FFF3E0;border:3px solid #FB923C;box-shadow:0 6px 0 #C2570C;','fade':'background:#fff;border:3px solid #E3ECFA;box-shadow:0 6px 0 #E3ECFA;opacity:.4;'}[state]
    tile={'ok':'#22C55E','retry':'#FB923C'}.get(state,acc)
    inner={'ok':ico('check',24,'#fff',3.6),'retry':ico('redo',22,'#fff',3)}.get(state,f'<span style="font-family:Poppins;font-weight:800;font-size:22px;color:#fff">{i+1}</span>')
    tag={'ok':'<span style="font-weight:800;font-size:14px;color:#15803D">Great!</span>','retry':'<span style="font-weight:800;font-size:14px;color:#C2570C">Try again</span>'}.get(state,'')
    return (f'<div style="height:92px;border-radius:26px;display:flex;align-items:center;gap:18px;padding:0 20px;{st}"><div style="width:52px;height:52px;border-radius:16px;background:{tile};display:flex;align-items:center;justify-content:center;flex:none">{inner}</div>'
            f'<div style="font-family:Poppins;font-weight:800;font-size:32px;color:#1B1250;flex:1">{word}</div>{tag}<div style="width:46px;height:46px;border-radius:14px;background:#EEF3FF;display:flex;align-items:center;justify-content:center">{ico("spk",24,"#4B2BB8",2.4)}</div></div>')
def options(words,states,title='Which word is this?',bottom='help'):
    ops=''.join(option(w,i,states[i]) for i,w in enumerate(words))
    if bottom=='help': b=f'<div style="margin:6px auto 0;width:max-content;height:56px;padding:0 26px;border-radius:18px;background:#fff;border:3px solid #BFA8F5;color:#5B3FD0;box-shadow:0 5px 0 #D9CCFA;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:10px;align-items:center">{ico("search",24,"#5B3FD0",2.6)}Need help?</div>'
    elif bottom=='used': b=f'<div style="margin:6px auto 0;width:max-content;height:56px;padding:0 26px;border-radius:18px;background:#F1F5FB;border:3px solid #E3ECFA;color:#8A97AE;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:10px;align-items:center">{ico("search",24,"#8A97AE",2.6)}Hint used</div>'
    else: b=f'<div style="margin:6px auto 0;width:max-content;height:62px;padding:0 38px;border-radius:19px;background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;font-family:Poppins;font-weight:800;font-size:21px;display:flex;gap:10px;align-items:center;box-shadow:0 5px 0 #0F7A37">Next word{ico("arrow",24,"#fff",3)}</div>'
    return f'<div style="position:absolute;left:900px;top:150px;width:500px"><div style="font-family:Poppins;font-weight:800;font-size:38px;color:#1B2B6B;text-align:center;margin-bottom:22px;text-shadow:0 2px 0 rgba(255,255,255,.7)">{title}</div><div style="display:flex;flex-direction:column;gap:18px">{ops}</div><div style="margin-top:24px">{b}</div></div>'
def pao_corner(pose,expr,say,prop=None,toast=None):
    p=pao(pose,expr,300,prop)
    return (f'<div style="position:absolute;left:34px;bottom:0">{p}</div>'
            f'<div style="position:absolute;left:260px;bottom:104px;max-width:440px"><div style="position:relative;background:#fff;border-radius:20px;padding:14px 20px;font-weight:700;font-size:18px;line-height:1.35;color:#14306B;box-shadow:0 5px 0 rgba(24,70,130,.22)">{say}<div style="position:absolute;left:-9px;bottom:26px;width:18px;height:18px;background:#fff;transform:rotate(45deg)"></div></div></div>')
def question():
    return screen(back()+progress(1,1)+stars_pill(1)+picture_card('pineapple')+options(['Pineapple','Grape','Strawberry'],['idle']*3)+pao_corner('relax','happy','Listen carefully. Which word is this?','phones'))
def correct():
    return screen(back()+progress(2,1)+stars_pill(2)+picture_card('pineapple',burst=True,ring='ok')+options(['Pineapple','Grape','Strawberry'],['ok','fade','fade'],title='You found it!',bottom='next')
                  +f'<div style="position:absolute;left:520px;top:172px;height:46px;padding:0 20px;border-radius:999px;background:#22C55E;color:#fff;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:8px;align-items:center;box-shadow:0 4px 0 #15803D"><svg width="22" height="22">{star(11,12,9,"#FFD43B","#fff")}</svg>+1 star</div>'+pao_corner('cheer','excited','Yes! Pineapple! You read it so well!'))
def retry():
    return screen(back()+progress(1,1)+stars_pill(1)+picture_card('pineapple',hint='P')+options(['Pineapple','Grape','Strawberry'],['idle','retry','fade'],title='Almost! Try again',bottom='used')+pao_corner('think','wink','Look at the first letter. It starts with P!','lens'))
def categories():
    cats=[('Fruits','apple','#FFE3E6','#F9A8B8','#BE123C',4),('Vegetables','carrot','#DDF7E5','#86DDA2','#15803D',2),('Animals','cat','#FFF1CC','#F6D774','#8A5A00',0),('Things','ball','#E7E4FF','#B9ADF5','#4B2BB8',1)]
    tl=''
    for n,ic,bg,bd,tc,k in cats:
        pips=''.join(f'<div style="width:12px;height:12px;border-radius:50%;background:{"#FFC53D" if i<k else "rgba(0,0,0,.1)"}"></div>' for i in range(6))
        tl+=(f'<div style="height:218px;border-radius:28px;background:{bg};border:3px solid {bd};box-shadow:0 7px 0 {bd};display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">{ill(ic,92)}<div style="font-family:Poppins;font-weight:800;font-size:26px;color:{tc};margin-top:4px">{n}</div><div style="font-size:14px;font-weight:700;color:{tc};opacity:.8">6 words</div><div style="display:flex;gap:5px;margin-top:6px">{pips}</div></div>')
    pc=pao('hello','happy',300,None)
    modal=(f'<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:720px;{CARD}padding:34px 36px 30px"><div style="position:absolute;right:20px;top:20px;width:48px;height:48px;border-radius:15px;background:#F1F5FB;display:flex;align-items:center;justify-content:center">{ico("x",20,"#5B6B85",2.8)}</div>'
           f'<div style="text-align:center;font-family:Poppins;font-weight:800;font-size:38px;color:#1B2B6B">What do you want to play?</div><div style="text-align:center;font-size:17px;font-weight:600;color:#5B6B85;margin:4px 0 24px">Tap a picture to start. Stars show the words you have mastered.</div>'
           f'<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">{tl}</div><div style="margin-top:24px;height:56px;border-radius:18px;background:#EEF3FF;color:#4B2BB8;font-family:Poppins;font-weight:800;font-size:18px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 0 #D3E1F8">Maybe later</div></div>'
           f'<div style="position:absolute;left:96px;bottom:0">{pc}</div><div style="position:absolute;left:40px;bottom:372px;width:290px"><div style="position:relative;background:#fff;border-radius:20px;padding:14px 20px;font-weight:700;font-size:18px;line-height:1.35;color:#14306B;box-shadow:0 5px 0 rgba(24,70,130,.22)">Hi Rene! What shall we read today?<div style="position:absolute;left:150px;bottom:-9px;width:18px;height:18px;background:#fff;transform:rotate(45deg)"></div></div></div>')
    return screen(back()+modal,dim=True)
def results():
    words=[('pineapple','Pineapple',0),('grape','Grape',0),('strawberry','Strawberry',1),('apple','Apple',0),('pineapple','Banana',0),('grape','Grapes',0)]
    words=[('pineapple','Pineapple',0),('grape','Grape',0),('strawberry','Strawberry',1),('apple','Apple',0)]
    chips=''.join(f'<div style="flex:1;border-radius:18px;background:#F4F9FF;border:2px solid #E3ECFA;padding:10px 6px 8px;text-align:center;position:relative"><div style="display:flex;justify-content:center">{ill(i,54)}</div><div style="font-weight:800;font-size:13px;color:#14306B;margin-top:2px">{w}</div><div style="position:absolute;right:6px;top:6px;width:22px;height:22px;border-radius:50%;background:{"#F59E0B" if h else "#22C55E"};display:flex;align-items:center;justify-content:center">{ico("search" if h else "check",12,"#fff",3.4)}</div></div>' for i,w,h in words)
    def stat(l,v,ic,c): return f'<div style="flex:1;border-radius:18px;background:#F4F1FF;padding:14px 8px;text-align:center"><div style="width:40px;height:40px;margin:0 auto 6px;border-radius:13px;background:{c};display:flex;align-items:center;justify-content:center">{ico(ic,22,"#fff",2.4)}</div><div style="font-family:Poppins;font-weight:800;font-size:26px;color:#2B1B7A;line-height:1">{v}</div><div style="font-size:12.5px;color:#5B6B85;font-weight:700;margin-top:3px">{l}</div></div>'
    def st(on,sz): return '<svg width=%d height=%d viewBox="0 0 70 70">%s</svg>'%(sz,sz,star(35,37,30,'#FFD43B','#F59E0B'))
    pc=pao('tada','proud',250)
    modal=(f'<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:840px;{CARD}padding:30px 36px 26px;text-align:center"><div style="font-family:Poppins;font-weight:800;font-size:38px;color:#2B1B7A;line-height:1.1">You read all the Fruits words!</div><div style="font-size:16px;color:#5B6B85;font-weight:600;margin-top:4px">Pao says: "Super reading, Rene!"</div>'
           f'<div style="display:flex;justify-content:center;align-items:flex-end;gap:26px;margin:6px 0 4px"><div style="width:190px;height:215px;overflow:hidden;border-radius:26px;background:linear-gradient(180deg,#E8F4FF,#BFE3FF);display:flex;align-items:flex-end;justify-content:center">{pc}</div><div style="display:flex;gap:6px;align-items:flex-end;padding-bottom:26px">{st(1,84)}<div style="margin-bottom:16px">{st(1,112)}</div>{st(1,84)}</div></div>'
           f'<div style="display:flex;gap:12px">{stat("First try","5 of 6","check","#22C55E")}{stat("Hints used","1","search","#F59E0B")}{stat("Time","1:24","clock","#6366F1")}{stat("Stars","3 of 3","star","#F59E0B")}</div>'
           f'<div style="display:flex;gap:10px;margin-top:14px">{chips}</div>'
           f'<div style="margin-top:14px;border-radius:18px;background:#FFFAEB;border:2px solid #F6E3A8;padding:12px 16px;display:flex;align-items:center;gap:14px;text-align:left"><div style="flex:none">{medal("book","got",52)}</div><div style="flex:1"><div style="font-weight:800;color:#14306B;font-size:15px">Word Wizard badge</div><div style="display:flex;align-items:center;gap:10px;margin-top:5px"><div style="flex:1;height:10px;border-radius:5px;background:#F1E3B3;overflow:hidden"><div style="width:50%;height:100%;background:#F59E0B"></div></div><span style="font-weight:800;color:#8A6410;font-size:13px">5/10</span></div></div><div style="font-size:13px;font-weight:800;color:#6D4AE0;max-width:170px;line-height:1.3">5 more wins unlock the Wizard Hat</div></div>'
           f'<div style="display:flex;gap:12px;margin-top:18px"><div style="flex:1.2;height:58px;border-radius:17px;background:linear-gradient(180deg,#27C25D,#16A34A);color:#fff;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #0F7A37">{ico("redo",22,"#fff",2.4)}Play again</div><div style="flex:1;height:58px;border-radius:17px;background:#EEF3FF;color:#4B2BB8;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #D3E1F8">{ico("grid",22,"#4B2BB8",2.4)}Pick another</div><div style="flex:1;height:58px;border-radius:17px;background:#EEF3FF;color:#4B2BB8;font-family:Poppins;font-weight:800;font-size:18px;display:flex;gap:9px;align-items:center;justify-content:center;box-shadow:0 5px 0 #D3E1F8">{ico("home",22,"#4B2BB8",2.4)}Back to games</div></div><div style="margin-top:12px;font-size:12.5px;color:#7B8AA3;font-weight:700">Preview mode: this score was not saved</div></div>')
    return screen(back()+modal,dim=True)
REACT=[('Ready','hello','happy',None,'Game starts','Let us read some fruit words!','Waves, head tilts'),
 ('Listening','relax','happy','phones','Hear it is playing','Listen carefully...','Headphones, sound waves pulse'),
 ('Thinking','think','happy',None,'No answer after 8 seconds','Take your time. You can do it!','Paw taps chin, thought bubbles'),
 ('Correct','cheer','excited',None,'Right answer','Yes! That is right!','Arms pump, stars twinkle'),
 ('Streak','jump','laugh',None,'3 right answers in a row','Wow! 3 in a row!','Leap and land, shadow shrinks'),
 ('Oops','relax','surprised',None,'First wrong answer','Oops! Have another look.','Gentle blink, head tilt'),
 ('Hint','think','wink','lens','Need help? is tapped','It starts with the letter P!','Magnifier glints, wink'),
 ('All done','tada','proud',None,'Last word finished','You read them all!','Arms open, sparkles')]
def board():
    cards=''
    for n,po,ex,pr,trig,line,mo in REACT:
        cards+=(f'<div style="{CARD}padding:14px 16px 16px;display:flex;flex-direction:column;align-items:center"><div style="width:100%;height:215px;border-radius:22px;background:linear-gradient(180deg,#D6F0FF,#EAF8FF 60%,#B8E8A0 61%,#8EE07A);display:flex;align-items:center;justify-content:center;overflow:hidden;position:relative">{pao(po,ex,205,pr)}</div>'
                f'<div style="font-family:Poppins;font-weight:800;font-size:22px;color:#2B1B7A;margin-top:10px">{n}</div><div style="font-size:12.5px;font-weight:700;color:#7B8AA3;margin-top:2px;text-align:center">{trig}</div>'
                f'<div style="font-size:14px;font-weight:700;color:#14306B;background:#F4F9FF;border-radius:12px;padding:7px 10px;margin-top:8px;text-align:center;width:100%">"{line}"</div>'
                f'<div style="display:flex;gap:6px;margin-top:9px;flex-wrap:wrap;justify-content:center"><span style="height:26px;padding:0 10px;border-radius:999px;background:#EAE4FF;color:#4B2BB8;font-weight:800;font-size:12px;display:flex;align-items:center">Pose: {po}</span><span style="height:26px;padding:0 10px;border-radius:999px;background:#FFF3C9;color:#8A5A00;font-weight:800;font-size:12px;display:flex;align-items:center">Face: {ex}</span></div>'
                f'<div style="font-size:11.5px;color:#7B8AA3;font-weight:600;margin-top:7px;text-align:center">{mo}</div></div>')
    return (f'<html><head><meta charset="utf-8"><style>*{{box-sizing:border-box}}body{{margin:0}}</style></head><body><div style="position:relative;width:1440px;height:1000px;overflow:hidden;font-family:Inter;background:linear-gradient(180deg,#5BB8F0 0%,#9AD8F8 60%,#D6F0FF 100%)"><div style="position:absolute;left:0;right:0;top:26px;text-align:center"><div style="font-size:13px;font-weight:800;letter-spacing:.14em;color:#2F4F9F">PICTURE WORD</div><div style="font-family:Poppins;font-weight:800;font-size:36px;color:#1B2B6B">Pao reactions for this game</div></div><div style="position:absolute;left:50%;top:104px;transform:translateX(-50%);width:1320px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px">{cards}</div></div></body></html>')
if __name__=='__main__':
    with sync_playwright() as p:
        b=p.chromium.launch(); pg=b.new_page(viewport={'width':1440,'height':900},device_scale_factor=1.25)
        def shot(n,h):
            pg.set_content(h); pg.wait_for_timeout(300)
            pg.evaluate("t=>document.querySelectorAll('svg').forEach(s=>s.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t}))",450)
            pg.screenshot(path=f'/home/claude/pngs/{n}.png')
        shot('258-picture-word-categories',categories()); shot('259-picture-word-question',question()); shot('260-picture-word-correct',correct()); shot('261-picture-word-hint-try-again',retry()); shot('262-picture-word-results',results()); pg.set_viewport_size({'width':1440,'height':1000}); shot('263-picture-word-pao-reactions',board())
        b.close()
