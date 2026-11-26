# Animated scenes for The Three Little Pigs, Goldilocks and the Three Bears, The Tortoise and the Hare.
# viewBox 0 0 480 300, pure SVG + CSS keyframes (class prefix sb-). Uses KF from story_art plus KF2 below.
import sys; sys.path.insert(0,'/home/claude/pao2')
import story_art as A
import story as S
from story_art import T, bubble, tree, bush, flower, meadow, sky, room_bg, wolf

KF2='''
@keyframes sbPuff{0%{opacity:0;transform:translateX(-14px) scaleX(.5)}30%{opacity:1}100%{opacity:0;transform:translateX(56px) scaleX(1.2)}}
@keyframes sbFall{0%,28%{transform:none;opacity:1}44%{transform:translate(10px,6px) rotate(8deg)}62%,88%{transform:translate(46px,40px) rotate(32deg) scale(.7);opacity:0}96%,100%{transform:none;opacity:1}}
@keyframes sbGrow{0%,6%{transform:scaleY(0)}26%,92%{transform:scaleY(1)}98%,100%{transform:scaleY(0)}}
@keyframes sbNum{0%,2%{opacity:0;transform:scale(.4)}6%,22%{opacity:1;transform:scale(1)}26%,100%{opacity:0;transform:scale(1.3)}}
@keyframes sbBreathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.05)}}
@keyframes sbGone{0%,66%{opacity:1}72%,94%{opacity:0}100%{opacity:1}}
@keyframes sbSet{0%,100%{transform:translateY(0)}50%{transform:translateY(10px)}}
@keyframes sbBlow{0%,100%{transform:scale(1)}50%{transform:scale(1.12,1.04)}}
@keyframes sbSlide{0%,8%{transform:translateX(var(--x0))}90%,100%{transform:translateX(var(--x1))}}
@keyframes sbDash{0%,6%{transform:translateX(0)}30%,100%{transform:translateX(var(--x1))}}
.sb-puff{transform-box:fill-box;animation:sbPuff 1.4s ease-out infinite;animation-delay:var(--d,0s)}
.sb-fall{transform-box:fill-box;transform-origin:50% 100%;animation:sbFall 6s ease-in infinite;animation-delay:var(--d,0s)}
.sb-grow{transform-box:fill-box;transform-origin:50% 100%;animation:sbGrow 6s ease-out infinite;animation-delay:var(--d,0s)}
.sb-num{transform-box:fill-box;transform-origin:50% 50%;opacity:0;animation:sbNum 6s ease-out infinite;animation-delay:var(--d,0s)}
.sb-breathe{transform-box:fill-box;transform-origin:50% 100%;animation:sbBreathe 2.6s ease-in-out infinite}
.sb-gone{animation:sbGone 6s linear infinite}
.sb-set{transform-box:fill-box;animation:sbSet 6s ease-in-out infinite}
.sb-blow{transform-box:fill-box;transform-origin:0% 50%;animation:sbBlow .8s ease-in-out infinite}
.sb-slide{transform-box:fill-box;animation:sbSlide 6s linear infinite}
.sb-dash{transform-box:fill-box;animation:sbDash 6s ease-in infinite}
@media (prefers-reduced-motion:reduce){.sb *{animation:none!important}.sb-num{opacity:0}}
'''
ALLKF=A.KF+KF2

def pig(outfit='#3B82F6',hat=None,hold=None,scarf=False,arm='down'): return S.pig_svg(outfit,hat,hold,scarf,arm)
def G(x,y,s,inner,cls='',flip=False): return T(x,y,s,flip,inner,cls)
def ground(c1='#7BCB6B',c2='#5FC77E'): return f'<path d="M0 214Q120 190 240 208T480 198V300H0z" fill="{c1}"/><path d="M0 254Q140 232 280 250T480 240V300H0z" fill="{c2}"/>'
def wind(x,y,n=3,d0=0):
    return ''.join(f'<g transform="translate({x} {y+i*16})"><g class="sb-puff" style="--d:{d0+i*.35}s"><path d="M0 0h34M6 6h26" stroke="#fff" stroke-width="4" stroke-linecap="round"/><path d="M34 0q8 0 8 -6" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></g></g>' for i in range(n))
def txt(x,y,t,size=26,col='#E5484D'): return f'<text x="{x}" y="{y}" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="{size}" fill="{col}">{t}</text>'
def spark(x,y,d=0,c='#FFD43B',s=1): return f'<g transform="translate({x} {y}) scale({s})"><g class="sb-twinkle" style="--d:{d}s"><path d="M0 -8l3 5 5 3-5 3-3 5-3-5-5-3 5-3z" fill="{c}"/></g></g>'
def heart(x,y,d=0,c='#F472B6'): return f'<g transform="translate({x} {y})"><g class="sb-rise" style="--d:{d}s"><path d="M0 8C0 0 -12 -2 -12 8C-12 16 0 22 0 22C0 22 12 16 12 8C12 -2 0 0 0 8z" fill="{c}"/></g></g>'
def zzz(x,y):
    return ''.join(f'<g transform="translate({x+i*14} {y-i*6})"><g class="sb-rise" style="--d:{i*.9}s"><text font-family="Poppins" font-weight="800" font-size="{20+i*4}" fill="#6366F1">Z</text></g></g>' for i in range(3))
def steam(x,y,n=3,col='#fff'):
    return ''.join(f'<g transform="translate({x+i*9-9} {y})"><g class="sb-rise" style="--d:{i*.6}s"><path d="M0 0q-6 -8 0 -14q6 -6 0 -14" fill="none" stroke="{col}" stroke-width="3.4" stroke-linecap="round"/></g></g>' for i in range(n))
def mini_house(x,y,kind,s=1,cls='',d=0):
    return f'<g transform="translate({x} {y}) scale({s})"><g class="{cls}" style="--d:{d}s">{S.house_svg(kind)}</g></g>'

# ================= THREE LITTLE PIGS =================
def p1():
    cot=f'<g transform="translate(70 232)">{S.house_svg("bricks")}</g>'
    ham='<g transform="translate(0 0)"><path d="M0 0l22 -22" stroke="#8A5A2B" stroke-width="6" stroke-linecap="round"/><rect x="14" y="-34" width="22" height="12" rx="3" fill="#94A3B8" stroke="#64748B" stroke-width="2" transform="rotate(-45 25 -28)"/></g>'
    return (meadow()+ground()+'<g transform="translate(70 234) scale(1.4)">'+S.house_svg('bricks')+'</g>'
            +T(210,262,1.4,False,pig('#A78BFA',None,None,False,'up'),'sb-bob')
            +T(320,262,1.05,False,pig('#3B82F6','straw',None,True,'up'),'sb-bob')
            +'<g style="animation-delay:.3s">'+T(372,264,1.05,False,pig('#F59E0B','cap'),'sb-bob')+'</g>'
            +T(424,266,1.05,False,pig('#2563EB','hard'),'sb-bob')
            +bubble(236,30,130,68,'<g transform="translate(36 44) scale(1.1)">'+ham+'</g><path d="M92 40C92 34 82 32 82 40C82 47 92 52 92 52C92 52 102 47 102 40C102 32 92 34 92 40z" fill="#F472B6"/>',.4,'l')
            +heart(166,150,0)+heart(190,160,1.2)+spark(300,120,.5))
def p2():
    def lot(x,kind,pigsvg,d):
        return (f'<g transform="translate({x} 252)">'
                +f'<g transform="scale(1.45)">{S.house_svg(kind)}</g>'.replace('<g transform="scale(1.45)">','<g transform="scale(1.45)"><g class="sb-grow" style="--d:'+str(d)+'s">').replace('</g>','</g></g>',1)
                +'</g>')
    o=meadow()+ground()
    o+=f'<g transform="translate(86 252) scale(1.5)"><g class="sb-grow" style="--d:0s">{S.house_svg("straw")}</g></g>'
    o+=f'<g transform="translate(242 252) scale(1.5)"><g class="sb-grow" style="--d:1.2s">{S.house_svg("sticks")}</g></g>'
    o+=f'<g transform="translate(396 252) scale(1.5)"><g class="sb-grow" style="--d:2.4s">{S.house_svg("bricks")}</g></g>'
    o+=T(150,284,.8,False,pig('#3B82F6','straw',None,True),'sb-bob')+T(306,284,.8,False,pig('#F59E0B','cap'),'sb-bob')+T(452,286,.8,False,pig('#2563EB','hard','brick'),'sb-bob')
    for x,d in [(60,.3),(216,1.5),(370,2.7)]: o+=spark(x,132,d)
    return o
def p3():
    return (meadow()+ground()+'<g transform="translate(150 252) scale(1.7)"><g class="sb-fall">'+S.house_svg('straw')+'</g></g>'
            +T(56,266,1.0,False,pig('#3B82F6','straw',None,True),'sb-bob')
            +T(420,258,1.1,True,wolf(True),'sb-blow')+wind(262,176,3,0)
            +bubble(190,24,150,64,txt(75,42,'Huff! Puff!',24),0.2,'r'))
def p4():
    return (meadow()+ground()+'<g transform="translate(410 252) scale(1.6)">'+S.house_svg('bricks')+'</g>'
            +'<g transform="translate(220 252) scale(1.7)"><g class="sb-fall">'+S.house_svg('sticks')+'</g></g>'
            +T(60,258,1.0,False,wolf(True),'sb-blow')+wind(110,176,3,0)
            +'<g style="--x0:0px;--x1:150px" class="sb-walk"><g transform="translate(190 268) scale(.85)"><g class="sb-step">'+pig('#3B82F6','straw',None,True)+'</g></g></g>'
            +'<g style="--x0:0px;--x1:140px" class="sb-walk"><g transform="translate(240 270) scale(.85)"><g class="sb-step">'+pig('#F59E0B','cap')+'</g></g></g>'
            +bubble(130,26,120,60,txt(60,40,'Run!',26,'#F59E0B'),.5,'l'))
def p5():
    return (meadow()+ground()+'<g transform="translate(300 258) scale(2.6)"><g class="sb-shake">'+S.house_svg('bricks')+'</g></g>'
            +T(70,260,1.15,False,wolf(True),'sb-blow')+wind(140,170,3,0)+wind(150,206,2,.6)
            +T(236,268,.95,False,pig('#2563EB','hard','brick'),'sb-bob')
            +bubble(60,28,160,64,txt(80,42,'Huff... Puff...',22,'#64748B'),0.2,'l')
            +'<g class="sb-twinkle" style="--d:.4s"><path d="M392 170l4 8 8 4-8 4-4 8-4-8-8-4 8-4z" fill="#fff"/></g>')
def p6():
    pot=('<g transform="translate(0 0)"><path d="M-40 -8Q-44 -54 0 -54Q44 -54 40 -8z" fill="#475569" stroke="#1F2937" stroke-width="3"/><rect x="-44" y="-58" width="88" height="10" rx="5" fill="#64748B" stroke="#1F2937" stroke-width="2.4"/><path d="M-30 -36Q0 -28 30 -36" stroke="#93C5FD" stroke-width="5" fill="none" stroke-linecap="round"/></g>')
    fire=''.join(f'<g transform="translate({x} 0)"><g class="sb-glow" style="animation-delay:{d}s"><path d="M0 0Q-12 -10 -4 -26Q0 -16 6 -22Q14 -10 0 0z" fill="#FB923C"/><path d="M0 -2Q-5 -8 0 -14Q5 -8 0 -2z" fill="#FDE047"/></g></g>' for x,d in [(-26,0),(0,.3),(26,.6)])
    inside=('<rect x="260" y="40" width="190" height="230" rx="18" fill="#FFF1DB" stroke="#E5C9A0" stroke-width="4"/><rect x="290" y="150" width="130" height="110" rx="8" fill="#7A4E33"/><rect x="304" y="164" width="102" height="96" rx="6" fill="#2B1B12"/>'
            +'<g transform="translate(355 258)">'+fire+'</g><g transform="translate(355 232) scale(.9)">'+pot+'</g>'+steam(340,168,3)+steam(372,168,2))
    roof=('<g transform="translate(110 262) scale(2.3)">'+S.house_svg('bricks')+'</g>')
    return (meadow()+ground()+roof+inside
            +T(300,268,.8,True,pig('#2563EB','hard'),'sb-bob')
            +'<g transform="translate(150 96)"><g class="sb-fall" style="--d:0s"><g transform="scale(-.55 .55)">'+wolf(False)+'</g></g></g>'
            +bubble(30,24,100,56,txt(50,38,'Gulp!',24,'#E5484D'),1.6,'r')+spark(470,60,0))
def p7():
    hs=''.join(f'<g transform="translate({x} 250) scale({s})">{S.house_svg(k)}</g>' for x,k,s in [(70,'straw',.9),(400,'sticks',.9)])
    return (meadow()+ground()+hs+'<g transform="translate(240 252) scale(1.9)">'+S.house_svg('bricks')+'</g>'
            +T(180,288,.95,False,pig('#3B82F6','straw',None,True,'up'),'sb-bob')+T(240,290,.95,False,pig('#F59E0B','cap'),'sb-bob')+T(300,288,.95,False,pig('#2563EB','hard','brick'),'sb-bob')
            +'<g style="--x0:0px;--x1:130px" class="sb-walk"><g transform="translate(380 270) scale(.5 .5)"><g class="sb-step"><g transform="scale(-1 1)">'+wolf(False)+'</g></g></g></g>'
            .replace('translate(380 270) scale(.5 .5)','translate(360 270) scale(.5 .5)').replace('<g transform="scale(-1 1)">','<g transform="scale(1 1)">')
            +heart(150,170,0)+heart(240,160,.8)+heart(330,170,1.6)+flower(30,270,'#F472B6',1.1,True,0)+flower(450,272,'#FBBF24',1.1,True,.4))

# ================= GOLDILOCKS =================
def goldi(arm='down',mouth='smile'):
    sk='#F6D2B0'
    o='<ellipse cx="0" cy="-76" rx="26" ry="32" fill="#F7CB45" stroke="#E5A92A" stroke-width="2"/>'+''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#F7CB45" stroke="#E5A92A" stroke-width="1.6"/>' for x,y,r in [(-25,-58,10),(25,-58,10),(-22,-40,9),(22,-40,9)])
    o+='<rect x="-10" y="-24" width="8" height="24" rx="3" fill="#3B6FE0"/><rect x="3" y="-24" width="8" height="24" rx="3" fill="#3B6FE0"/><ellipse cx="-8" cy="0" rx="9" ry="5" fill="#7C3F1D"/><ellipse cx="9" cy="0" rx="9" ry="5" fill="#7C3F1D"/>'
    o+='<path d="M-19 -22L-14 -60Q0 -64 14 -60L19 -22z" fill="#E5484D" stroke="#B91C2C" stroke-width="2" stroke-linejoin="round"/><path d="M-12 -22L-10 -48H10L12 -22z" fill="#3B6FE0"/><path d="M-9 -48V-58M9 -48V-58" stroke="#3B6FE0" stroke-width="5"/>'
    o+='<path d="M-14 -56L-25 -36" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="-25" cy="-34" r="4.6" fill="'+sk+'"/>'
    if arm=='up': o+='<g class="sb-wave"><path d="M14 -56L32 -80" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="33" cy="-83" r="4.6" fill="'+sk+'"/></g>'
    elif arm=='spoon': o+='<path d="M14 -56L30 -44" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="31" cy="-43" r="4.6" fill="'+sk+'"/><path d="M31 -43l10 -12" stroke="#94A3B8" stroke-width="3" stroke-linecap="round"/><ellipse cx="43" cy="-58" rx="4" ry="5" fill="#CBD5E1"/>'
    else: o+='<path d="M14 -56L25 -36" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="25" cy="-34" r="4.6" fill="'+sk+'"/>'
    m={'smile':'<path d="M-5 -70q5 5 10 0" stroke="#B4533A" stroke-width="2" fill="none" stroke-linecap="round"/>','open':'<ellipse cx="0" cy="-69" rx="4" ry="5" fill="#B4533A"/>','worry':'<path d="M-5 -67q5 -4 10 0" stroke="#B4533A" stroke-width="2" fill="none" stroke-linecap="round"/>'}[mouth]
    o+=f'<ellipse cx="0" cy="-76" rx="17" ry="18" fill="{sk}"/><path d="M-17 -80Q-15 -98 0 -98Q15 -98 17 -80Q8 -90 0 -88Q-8 -90 -17 -80z" fill="#F7CB45" stroke="#E5A92A" stroke-width="1.6"/><path d="M-16 -84Q0 -98 16 -84" fill="none" stroke="#EF4444" stroke-width="4" stroke-linecap="round"/><g transform="translate(15 -88)"><path d="M0 0L9 -6L8 6zM0 0L-8 -6L-7 6z" fill="#EF4444"/><circle r="2.6" fill="#EF4444"/></g>'
    o+='<g class="sb-blink"><circle cx="-6" cy="-77" r="2.6" fill="#3B82F6"/><circle cx="6" cy="-77" r="2.6" fill="#3B82F6"/></g>'+m+'<circle cx="-11" cy="-71" r="3.4" fill="#F59DA0" opacity=".7"/><circle cx="11" cy="-71" r="3.4" fill="#F59DA0" opacity=".7"/>'
    return o
BEARS=[('#B9794A','#8A5A2B','#F3D2AE','cap',1.15),('#D9A066','#A66B35','#F8E0BC','bonnet',1.0),('#C98B58','#8A5A2B','#F3D2AE','bow',.62)]
def bear(i,x,y,k=1,flip=False,cls='sb-bob',d=0):
    f,dk,sn,ac,s=BEARS[i]
    return f'<g style="animation-delay:{d}s">'+T(x,y,s*k,flip,S.bear_svg(f,dk,sn,ac),cls)+'</g>'
def cottage(x,y,s=1,door_open=True):
    d='<rect x="-6" y="-18" width="12" height="22" rx="6" fill="#7A4E33"/>' if not door_open else '<rect x="-7" y="-20" width="14" height="24" rx="7" fill="#2B1B12"/><path d="M-7 -20Q-16 -18 -14 6L-7 4z" fill="#A9673D"/>'
    return f'<g transform="translate({x} {y}) scale({s})"><rect x="-34" y="-44" width="68" height="46" fill="#F8E3C4" stroke="#B9784A" stroke-width="2.4"/><rect x="16" y="-68" width="10" height="24" fill="#C2543A" stroke="#7F1D1D" stroke-width="2"/><path d="M-44 -42L0 -80L44 -42z" fill="#D9654B" stroke="#9A3412" stroke-width="2.6" stroke-linejoin="round"/>{d}<rect x="-30" y="-32" width="14" height="14" rx="2" fill="#BFE6FB" stroke="#B9784A" stroke-width="2"/></g>'
def table(x,y,w=250):
    return f'<g transform="translate({x} {y})"><rect x="0" y="0" width="{w}" height="14" rx="6" fill="#B9784A"/><rect x="14" y="14" width="12" height="{236-y-14}" fill="#9A6236"/><rect x="{w-26}" y="14" width="12" height="{236-y-14}" fill="#9A6236"/></g>'
def bowl(x,y,s,col='#fff',inner='#F6E2B3'):
    return f'<g transform="translate({x} {y}) scale({s})"><ellipse cx="0" cy="-2" rx="26" ry="9" fill="{inner}" stroke="#CBD5E1" stroke-width="2"/><path d="M-26 -2Q-24 20 0 20Q24 20 26 -2z" fill="{col}" stroke="#CBD5E1" stroke-width="2.4"/><path d="M-12 8Q0 14 12 8" stroke="#E0E7F5" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
def chair(x,y,s,col):
    return f'<g transform="translate({x} {y}) scale({s})"><rect x="-22" y="-80" width="8" height="80" rx="3" fill="{col}"/><rect x="14" y="-80" width="8" height="80" rx="3" fill="{col}"/><rect x="-22" y="-80" width="44" height="12" rx="4" fill="{col}"/><rect x="-24" y="-36" width="48" height="12" rx="4" fill="{col}" stroke="#7C4A1E" stroke-width="2"/><rect x="-20" y="-24" width="6" height="24" fill="{col}"/><rect x="14" y="-24" width="6" height="24" fill="{col}"/></g>'
def bed(x,y,w,col,s=1):
    return f'<g transform="translate({x} {y}) scale({s})"><rect x="0" y="-30" width="{w}" height="30" rx="8" fill="#fff" stroke="#E0E7F5" stroke-width="2.4"/><rect x="-10" y="-56" width="12" height="56" rx="5" fill="#8B5A3C"/><rect x="{w-2}" y="-44" width="10" height="44" rx="4" fill="#8B5A3C"/><path d="M12 -22Q{w/2} -30 {w-8} -22V-4H12z" fill="{col}"/><ellipse cx="22" cy="-32" rx="18" ry="7" fill="#fff" stroke="#E0E7F5" stroke-width="2"/></g>'

def g1():
    return (room_bg('#FFF1DB','#D9B88E')+table(40,176,230)+bowl(90,176,1.15,'#fff')+bowl(150,176,.95,'#fff')+bowl(205,176,.7,'#fff')
            +steam(90,150,3)+steam(150,152,2)+steam(205,156,2)
            +cottage(0,0,0.001)
            +'<g style="--x0:0px;--x1:140px" class="sb-walk">'+bear(0,310,262,1,False,'sb-step',0)+bear(1,356,262,1,False,'sb-step',.15)+bear(2,396,262,1,False,'sb-step',.3)+'</g>'
            +bubble(262,34,120,60,'<g transform="translate(60 30)">'+steam(-6,12,3,'#F59E0B')+'<text x="22" y="14" font-family="Poppins" font-weight="800" font-size="22" fill="#F59E0B">hot!</text></g>',.5,'l'))
def g2():
    return (meadow()+ground()+cottage(380,246,2.0,True)+tree(60,236,.9,'#2F8F55')
            +'<g style="--x0:0px;--x1:190px" class="sb-walk"><g transform="translate(90 266) scale(1.15)"><g class="sb-step">'+goldi('up')+'</g></g></g>'
            +bubble(250,40,128,58,txt(64,40,'Knock! Knock!',20,'#B9784A'),3.0,'l')
            +flower(30,280,'#F472B6',1.1,True,0)+flower(200,284,'#FBBF24',1,True,.4)+flower(310,282,'#C084FC',1,True,.8))
def g3():
    return (room_bg('#FFF1DB','#D9B88E')+table(70,176,340)+bowl(130,176,1.3)+bowl(220,176,1.05)+bowl(300,176,.78)
            +steam(130,146,3)+'<g transform="translate(220 146)"><g class="sb-twinkle" style="--d:.3s"><path d="M0 -10v20M-10 0h20M-7 -7l14 14M-7 7l14 -14" stroke="#60A5FA" stroke-width="3" stroke-linecap="round"/></g></g>'
            +spark(300,140,0.2)+spark(318,152,.8)
            +T(410,262,1.2,True,goldi('spoon'),'sb-bob')
            +bubble(60,30,150,58,txt(75,38,'Just right!',22,'#22A559'),.8,'l'))
def g4():
    return (room_bg('#FFE9CF','#D9B88E')+chair(110,250,1.35,'#B9784A')+chair(220,250,1.1,'#D9A066')
            +'<g transform="translate(330 250)"><g class="sb-fall">'+chair(0,0,.8,'#E9B26E')+'</g></g>'
            +T(300,250,1.0,False,goldi('up','open'),'sb-shake')
            +bubble(330,40,110,58,txt(55,38,'Oops!',24,'#E5484D'),2.0,'l')+spark(370,200,2.2,'#fff'))
def g5():
    sleeping=('<g transform="translate(0 0)"><ellipse cx="22" cy="-40" rx="22" ry="24" fill="#F7CB45" stroke="#E5A92A" stroke-width="2"/><ellipse cx="24" cy="-34" rx="14" ry="15" fill="#F6D2B0"/><path d="M16 -34q4 3 8 0M28 -34q4 3 8 0" stroke="#3B2412" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M20 -26q4 2 8 0" stroke="#B4533A" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="14" cy="-28" r="3" fill="#F59DA0" opacity=".7"/></g>')
    return (room_bg('#EDE6FF','#C9B6F0')+bed(36,248,130,'#6366F1',1.0)+bed(190,248,110,'#F59E0B',.95)
            +bed(330,248,86,'#22A559',.95)+'<g transform="translate(336 218)"><g class="sb-breathe">'+sleeping+'</g></g>'
            +zzz(380,170)+spark(100,130,.2,'#fff')+spark(250,120,.9,'#fff'))
def g6():
    return (room_bg('#EDE6FF','#C9B6F0')+bed(40,250,92,'#22A559',1.1)
            +'<g transform="translate(46 222) scale(1.1)"><g class="sb-shake"><ellipse cx="22" cy="-40" rx="22" ry="24" fill="#F7CB45" stroke="#E5A92A" stroke-width="2"/><ellipse cx="24" cy="-34" rx="14" ry="15" fill="#F6D2B0"/><circle cx="19" cy="-36" r="2.6" fill="#3B82F6"/><circle cx="31" cy="-36" r="2.6" fill="#3B82F6"/><ellipse cx="25" cy="-26" rx="3.6" ry="4.4" fill="#B4533A"/></g></g>'
            +bear(0,420,262,1.25,True,'sb-bob',0)+bear(1,350,262,1.1,True,'sb-bob',.2)+bear(2,260,262,1.3,True,'sb-bob',.4)
            +bubble(150,28,170,64,txt(85,42,'Here she is!',22,'#E5484D'),.5,'r')
            +'<g transform="translate(228 160)"><g class="sb-pop" style="--d:.9s"><text font-family="Poppins" font-weight="800" font-size="34" fill="#F59E0B">!</text></g></g>')
def g7():
    return (meadow()+ground()+cottage(90,246,1.9,True)+tree(430,236,1.0,'#2F8F55')
            +bear(0,60,264,.8,False,'sb-bob',0)+bear(1,120,264,.8,False,'sb-bob',.2)
            +'<g style="--x0:0px;--x1:260px" class="sb-walk"><g transform="translate(150 268) scale(1.15)"><g class="sb-step">'+goldi('up','open')+'</g></g></g>'
            +bubble(250,30,140,58,txt(70,40,'Never again!',20,'#22A559'),.6,'l')
            +flower(300,284,'#F472B6',1.1,True,0)+flower(400,284,'#FBBF24',1,True,.5))

# ================= TORTOISE AND HARE =================
def squirrel(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><g class="sb-bob"><path d="M16 4Q34 -4 30 -28Q22 -20 20 -8z" fill="#C2754A" stroke="#8A4B24" stroke-width="2"/><ellipse cx="0" cy="-8" rx="14" ry="16" fill="#C2754A" stroke="#8A4B24" stroke-width="2"/><ellipse cx="0" cy="-4" rx="8" ry="10" fill="#FBE4CC"/><circle cx="0" cy="-30" r="11" fill="#C2754A" stroke="#8A4B24" stroke-width="2"/><path d="M-9 -38L-8 -48L-1 -40zM9 -38L8 -48L1 -40z" fill="#C2754A" stroke="#8A4B24" stroke-width="2" stroke-linejoin="round"/><circle cx="-4" cy="-31" r="1.8" fill="#3B2412"/><circle cx="4" cy="-31" r="1.8" fill="#3B2412"/><ellipse cx="0" cy="-26" rx="2.6" ry="1.8" fill="#3B2412"/></g></g>'
def hedgehog(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><g class="sb-bob"><path d="M-18 0Q-22 -26 0 -28Q22 -26 18 0z" fill="#8A6A4A" stroke="#5B4028" stroke-width="2"/><path d="M-12 -18l4 -6M-4 -22l4 -6M6 -22l4 -6M12 -14l6 -4" stroke="#5B4028" stroke-width="2" stroke-linecap="round"/><ellipse cx="16" cy="-6" rx="9" ry="7" fill="#F3D2AE" stroke="#5B4028" stroke-width="2"/><circle cx="21" cy="-7" r="2.6" fill="#3B2412"/><circle cx="14" cy="-9" r="1.6" fill="#3B2412"/></g></g>'
def bluebird(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><g class="sb-bob"><ellipse cx="0" cy="0" rx="11" ry="9" fill="#60A5FA" stroke="#1D4ED8" stroke-width="2"/><circle cx="-9" cy="-6" r="6.6" fill="#60A5FA" stroke="#1D4ED8" stroke-width="2"/><path d="M-15 -6l-7 2l7 3z" fill="#FBBF24"/><circle cx="-10" cy="-7" r="1.6" fill="#1F2937"/><path d="M6 -2l10 4l-10 3z" fill="#1D4ED8"/></g></g>'
def rooster(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><g class="sb-bob"><path d="M14 -20Q36 -40 30 -64Q18 -48 8 -40z" fill="#EF4444" stroke="#B91C1C" stroke-width="2"/><path d="M10 -22Q40 -30 34 -52Q22 -38 6 -34z" fill="#F59E0B" stroke="#B45309" stroke-width="2"/><ellipse cx="0" cy="-22" rx="20" ry="18" fill="#fff" stroke="#CBD5E1" stroke-width="2.4"/><path d="M-8 -22Q4 -14 14 -26" fill="#F3F4F6" stroke="#CBD5E1" stroke-width="2"/><circle cx="-14" cy="-44" r="11" fill="#fff" stroke="#CBD5E1" stroke-width="2.4"/><path d="M-20 -54Q-14 -64 -8 -54Q-4 -62 0 -52" fill="#EF4444" stroke="#B91C1C" stroke-width="2" stroke-linejoin="round"/><path d="M-25 -44l-10 3l10 4z" fill="#F59E0B" stroke="#B45309" stroke-width="1.6"/><path d="M-20 -36q-2 8 2 10q4 -2 2 -10z" fill="#EF4444"/><circle cx="-16" cy="-47" r="2" fill="#1F2937"/><path d="M-8 -4v10M6 -4v10M-12 6h8M2 6h8" stroke="#F59E0B" stroke-width="3" stroke-linecap="round"/></g></g>'
def fin(x,y,s=1,tape=True):
    t='<g class="sb-gone"><path d="M0 4Q42 12 86 4" fill="none" stroke="#EF4444" stroke-width="4"/></g>' if tape else ''
    return f'<g transform="translate({x} {y}) scale({s})"><rect x="-3" y="0" width="6" height="52" fill="#fff" stroke="#CBD5E1" stroke-width="1.6"/><rect x="83" y="0" width="6" height="52" fill="#fff" stroke="#CBD5E1" stroke-width="1.6"/>{t}</g>'
def hare(x,y,s=1,cls='sb-bob',flip=False): return T(x,y,s,flip,S.hare_svg(),cls)
def tort(x,y,s=1,cls='sb-step',flip=False): return T(x,y,s,flip,S.tort_svg(),cls)
def tsky(): return sky()+ground('#9BDC7A','#7BCB6B')+'<path d="M0 268Q130 252 260 266T480 258V300H0z" fill="#EBD9A0"/>'
def t1():
    return (tsky()+tree(430,226,1.0,'#3FA55E')+squirrel(330,270,1.1)+hedgehog(380,284,1.0)+bluebird(300,170,1.1)
            +hare(150,278,1.35,'sb-bob')
            +''.join(spark(x,y,d,'#FFD43B',1.2) for x,y,d in [(90,150,0),(230,140,.5),(210,250,1),(90,250,1.4)])
            +bubble(210,30,130,62,txt(65,40,'So fast!',24,'#F59E0B'),.5,'l'))
def t2():
    return (tsky()+tree(40,226,.9,'#3FA55E')
            +hare(120,278,1.3,'sb-shake')
            +'<g style="--x0:-30px;--x1:40px" class="sb-slide">'+tort(330,278,1.35,'sb-step')+'</g>'
            +bubble(60,26,150,62,txt(75,40,'Hurry up!',24,'#E5484D'),.4,'l')
            +bubble(290,34,150,60,txt(75,38,'Soon enough!',19,'#22A559'),2.2,'r'))
def t3():
    return (tsky()+fin(60,176,1.5,False)
            +hare(150,282,1.0,'sb-bob')+tort(262,284,1.0,'sb-step')
            +'<g transform="translate(350 252)"><rect x="-20" y="0" width="40" height="40" fill="#8A5A2B"/></g>'+rooster(350,254,1.5)
            +bluebird(440,170,1.2)+squirrel(420,282,.9)
            +''.join(f'<g transform="translate(300 90)"><g class="sb-num" style="--d:{d}s">{txt(0,0,t,54,c)}</g></g>' for t,d,c in [('3',0,'#E5484D'),('2',1.5,'#F59E0B'),('1',3.0,'#22A559'),('GO!',4.5,'#2563EB')]))
def t4():
    dust=''.join(f'<g transform="translate({60+i*24} {250-i*6})"><g class="sb-puff" style="--d:{i*.3}s"><circle r="{6-i}" fill="#fff" opacity=".8"/></g></g>' for i in range(4))
    return (tsky()+tree(430,232,1.1,'#3FA55E')+tree(250,222,.7,'#46B56A')
            +'<g style="--x1:620px" class="sb-dash"><g transform="translate(110 258) scale(.95)">'+'<g class="sb-step">'+S.hare_svg()+'</g></g>'+dust+'</g>'
            +'<g style="--x0:0px;--x1:90px" class="sb-slide">'+tort(130,284,1.3,'sb-step')+'</g>'
            +'<g transform="translate(60 112)"><g class="sb-pop" style="--d:.6s"><rect width="96" height="58" rx="14" fill="#fff" stroke="#E0E7F5" stroke-width="2"/><ellipse cx="48" cy="29" rx="24" ry="14" fill="#fff" stroke="#2F8F55" stroke-width="3"/><circle cx="52" cy="29" r="9" fill="#2F8F55"/><circle cx="55" cy="26" r="3" fill="#fff"/></g></g>'
            +'<path d="M180 282Q300 272 440 282" fill="none" stroke="#C9A173" stroke-width="4" stroke-dasharray="4 12" stroke-linecap="round"/>')
def t5():
    return (tsky()+tree(240,262,1.7,'#3FA55E')
            +'<g transform="translate(150 266)"><g class="sb-breathe"><g transform="rotate(-84 0 0)">'+S.hare_svg()+'</g></g></g>'
            +zzz(190,196)
            +'<g style="--x0:0px;--x1:60px" class="sb-slide">'+tort(360,282,.7,'sb-step')+'</g>'
            +'<g transform="translate(420 70)"><circle r="22" fill="#FFD43B"/></g>'+bluebird(70,120,1.1))
def t6():
    return (tsky()+fin(360,180,1.0,False)
            +'<g transform="translate(130 244) scale(.9)"><g class="sb-breathe"><g transform="rotate(-84 0 0)">'+S.hare_svg()+'</g></g></g>'
            +zzz(168,180)+'<g style="--x0:-60px;--x1:200px" class="sb-slide">'+tort(70,294,1.2,'sb-step')+'</g>'
            +bubble(240,34,100,54,txt(50,38,'Shh...',22,'#64748B'),1.0,'l'))
def t7():
    return ('<defs><linearGradient id="ss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FDBA74"/><stop offset=".6" stop-color="#FCA5A5"/><stop offset="1" stop-color="#FDE68A"/></linearGradient></defs><rect width="480" height="300" fill="url(#ss)"/>'
            +'<g class="sb-set"><circle cx="90" cy="150" r="34" fill="#FEF08A"/></g>'
            +'<path d="M0 214Q120 190 240 208T480 198V300H0z" fill="#86C06B"/><path d="M0 254Q140 232 280 250T480 240V300H0z" fill="#6FB05E"/>'
            +fin(330,196,1.45,True)
            +'<g style="--x0:0px;--x1:200px" class="sb-slide">'+tort(150,280,1.3,'sb-step')+'</g>'
            +'<g style="--x1:110px" class="sb-dash"><g transform="translate(40 270) scale(.55)">'+'<g class="sb-step">'+S.hare_svg()+'</g></g></g>'
            +squirrel(430,282,1.0)+hedgehog(400,292,.9)+bluebird(450,170,1.1)
            +''.join(spark(x,y,d,'#fff',1.3) for x,y,d in [(300,120,0),(380,110,.5),(440,130,1),(340,170,1.5)])
            +'<g transform="translate(240 56)"><g class="sb-pop" style="--d:.4s"><rect x="-70" y="-24" width="140" height="48" rx="24" fill="#fff" stroke="#F59E0B" stroke-width="4"/>'+txt(0,9,'Winner!',26,'#F59E0B')+'</g></g>')

STORIES={
 'pigs':{'title':'The Three Little Pigs','scenes':[p1,p2,p3,p4,p5,p6,p7]},
 'goldi':{'title':'Goldilocks and the Three Bears','scenes':[g1,g2,g3,g4,g5,g6,g7]},
 'tort':{'title':'The Tortoise and the Hare','scenes':[t1,t2,t3,t4,t5,t6,t7]},
 'red':{'title':'Little Red Riding Hood','scenes':A.SCENES},
}
def scene(story,i,w='100%',h='100%',extra=''):
    return f'<svg class="sb" viewBox="0 0 480 300" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" style="display:block;{extra}"><style>{ALLKF}</style>{STORIES[story]["scenes"][i]()}</svg>'
if __name__=='__main__':
    from playwright.sync_api import sync_playwright
    names=['pigs','goldi','tort']
    h='<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(4,480px);gap:6px">'+''.join(scene(n,i,480,300) for n in names for i in range(7))+'</body>'
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':1960,'height':1280});pg.set_content(h);pg.wait_for_timeout(400)
        pg.evaluate("document.getAnimations().forEach(a=>{a.pause();a.currentTime=3400})");pg.screenshot(path='/tmp/scenes2.png');b.close()
