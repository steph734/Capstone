# Animated Little Red Riding Hood scenes. viewBox 0 0 480 300. Pure SVG + CSS keyframes (class prefix sb-).
KF='''
@keyframes sbBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes sbSway{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}
@keyframes sbWave{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(16deg)}}
@keyframes sbWalk{0%,6%{transform:translateX(var(--x0))}72%,100%{transform:translateX(var(--x1))}}
@keyframes sbStep{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes sbIn{0%,4%{opacity:0;transform:translate(var(--dx),var(--dy)) scale(.6)}16%{opacity:1;transform:translate(calc(var(--dx)*.4),-30px) scale(1.1)}26%,86%{opacity:1;transform:none}96%,100%{opacity:0;transform:none}}
@keyframes sbPeek{0%,8%{transform:translateX(86px)}28%,80%{transform:translateX(0)}94%,100%{transform:translateX(86px)}}
@keyframes sbPop{0%,14%{opacity:0;transform:scale(.3)}26%,80%{opacity:1;transform:scale(1)}92%,100%{opacity:0;transform:scale(.5)}}
@keyframes sbBlink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes sbRun{0%,8%{transform:translateX(230px)}50%,100%{transform:translateX(0)}}
@keyframes sbRise{0%{opacity:0;transform:translateY(12px) scale(.5)}25%{opacity:1}100%{opacity:0;transform:translateY(-80px) scale(1.1)}}
@keyframes sbFlip{0%,10%{transform:scaleX(0)}22%,84%{transform:scaleX(1)}96%,100%{transform:scaleX(0)}}
@keyframes sbTwinkle{0%,100%{opacity:.25;transform:scale(.7)}50%{opacity:1;transform:scale(1.15)}}
@keyframes sbFly{0%{transform:translate(0,0)}25%{transform:translate(40px,-20px)}50%{transform:translate(80px,6px)}75%{transform:translate(30px,-14px)}100%{transform:translate(0,0)}}
@keyframes sbRing{0%,100%{opacity:0;transform:scale(.6)}20%,40%{opacity:1;transform:scale(1)}60%{opacity:0;transform:scale(1.2)}}
@keyframes sbWag{0%,100%{transform:rotate(-16deg)}50%{transform:rotate(18deg)}}
@keyframes sbShake{0%,100%{transform:rotate(0)}25%{transform:rotate(-4deg)}75%{transform:rotate(4deg)}}
@keyframes sbGlow{0%,100%{opacity:.35}50%{opacity:.9}}
.sb-bob{transform-box:fill-box;animation:sbBob 2.2s ease-in-out infinite}
.sb-sway{transform-box:fill-box;transform-origin:50% 100%;animation:sbSway 3s ease-in-out infinite}
.sb-wave{transform-box:fill-box;transform-origin:0% 100%;animation:sbWave 1.1s ease-in-out infinite}
.sb-walk{transform-box:fill-box;animation:sbWalk 6s ease-in-out infinite}
.sb-step{transform-box:fill-box;animation:sbStep .5s ease-in-out infinite}
.sb-in{transform-box:fill-box;animation:sbIn 6s ease-in-out infinite;animation-delay:var(--d,0s)}
.sb-peek{transform-box:fill-box;animation:sbPeek 6s ease-in-out infinite}
.sb-pop{transform-box:fill-box;transform-origin:0% 100%;animation:sbPop 6s ease-in-out infinite;animation-delay:var(--d,0s)}
.sb-blink{transform-box:fill-box;transform-origin:50% 50%;animation:sbBlink 3.4s infinite}
.sb-run{transform-box:fill-box;animation:sbRun 6s ease-out infinite}
.sb-rise{transform-box:fill-box;animation:sbRise 3s ease-out infinite;animation-delay:var(--d,0s)}
.sb-flip{transform-box:fill-box;transform-origin:50% 50%;animation:sbFlip 6s ease-in-out infinite;animation-delay:var(--d,0s)}
.sb-twinkle{transform-box:fill-box;transform-origin:50% 50%;animation:sbTwinkle 1.8s ease-in-out infinite;animation-delay:var(--d,0s)}
.sb-fly{transform-box:fill-box;animation:sbFly 5s ease-in-out infinite}
.sb-ring{transform-box:fill-box;transform-origin:50% 50%;animation:sbRing 6s ease-in-out infinite;animation-delay:var(--d,0s)}
.sb-wag{transform-box:fill-box;transform-origin:0% 100%;animation:sbWag .7s ease-in-out infinite}
.sb-shake{transform-box:fill-box;transform-origin:50% 100%;animation:sbShake .5s ease-in-out infinite}
.sb-glow{transform-box:fill-box;animation:sbGlow 1.6s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.sb *{animation:none!important}}
'''
SK='#F6D2B0'
def T(x,y,s=1,flip=False,inner='',cls=''):
    sc=f'scale({-s} {s})' if flip else f'scale({s})'
    return f'<g transform="translate({x} {y}) {sc}"><g class="{cls}">{inner}</g></g>'
def face(y=-78,mouth='smile'):
    m={'smile':'<path d="M-4 -73q4 4 8 0" stroke="#B4533A" stroke-width="1.8" fill="none" stroke-linecap="round"/>','open':'<ellipse cx="0" cy="-72" rx="4" ry="5" fill="#B4533A"/>','worry':'<path d="M-4 -71q4 -3 8 0" stroke="#B4533A" stroke-width="1.8" fill="none" stroke-linecap="round"/>'}[mouth]
    return f'<ellipse cx="0" cy="{y}" rx="14.5" ry="15" fill="{SK}"/><g class="sb-blink"><circle cx="-5" cy="{y-2}" r="2" fill="#3B2412"/><circle cx="5" cy="{y-2}" r="2" fill="#3B2412"/></g>{m}<circle cx="-9" cy="{y+4}" r="2.6" fill="#F59DA0" opacity=".7"/><circle cx="9" cy="{y+4}" r="2.6" fill="#F59DA0" opacity=".7"/>'
def red(arm='down',basket=False,mouth='smile'):
    o='<rect x="-11" y="-24" width="7" height="22" rx="3" fill="%s"/><rect x="4" y="-24" width="7" height="22" rx="3" fill="%s"/><ellipse cx="-9" cy="0" rx="9" ry="5" fill="#7C3F1D"/><ellipse cx="9" cy="0" rx="9" ry="5" fill="#7C3F1D"/>'%(SK,SK)
    o+='<path d="M-20 -22 L-13 -62 Q0 -68 13 -62 L20 -22z" fill="#E5484D" stroke="#B91C2C" stroke-width="2" stroke-linejoin="round"/><path d="M-9 -26L-6 -56H6L9 -26z" fill="#fff" opacity=".9"/>'
    o+='<path d="M-14 -58L-24 -36" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="-24" cy="-34" r="4.6" fill="%s"/>'%SK
    if arm=='up': o+='<g class="sb-wave"><path d="M14 -58L31 -84" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="32" cy="-87" r="4.6" fill="%s"/></g>'%SK
    elif arm=='stop': o+='<path d="M14 -58L34 -70" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="36" cy="-72" r="5.6" fill="%s"/>'%SK
    else: o+='<path d="M14 -58L24 -36" stroke="#E5484D" stroke-width="7" stroke-linecap="round"/><circle cx="24" cy="-34" r="4.6" fill="%s"/>'%SK
    if basket: o+='<g transform="translate(25 -30)"><path d="M-10 -2h20l-3 15h-14z" fill="#D69048" stroke="#9A5B1E" stroke-width="1.8" stroke-linejoin="round"/><path d="M-8 -2Q0 -18 8 -2" fill="none" stroke="#9A5B1E" stroke-width="2.4"/><path d="M-8 -2Q0 -9 8 -2" fill="#E5484D"/></g>'
    o+='<path d="M-21 -80Q-21 -108 0 -108Q21 -108 21 -80Q21 -66 0 -64Q-21 -66 -21 -80z" fill="#E5484D" stroke="#B91C2C" stroke-width="2"/>'+face(-78,mouth)+'<path d="M-17 -85Q0 -99 17 -85Q0 -91 -17 -85z" fill="#E5484D"/>'
    return o
def mom():
    o='<rect x="-9" y="-22" width="7" height="22" rx="3" fill="%s"/><rect x="3" y="-22" width="7" height="22" rx="3" fill="%s"/><ellipse cx="-8" cy="0" rx="9" ry="5" fill="#6B3E26"/><ellipse cx="8" cy="0" rx="9" ry="5" fill="#6B3E26"/>'%(SK,SK)
    o+='<path d="M-24 -20L-15 -72Q0 -78 15 -72L24 -20z" fill="#14B8A6" stroke="#0D7F74" stroke-width="2" stroke-linejoin="round"/><path d="M-11 -24L-8 -62H8L11 -24z" fill="#fff" opacity=".92"/>'
    o+='<path d="M-15 -68L-26 -42" stroke="#14B8A6" stroke-width="8" stroke-linecap="round"/><circle cx="-26" cy="-40" r="5" fill="%s"/><g class="sb-wave"><path d="M15 -68L33 -96" stroke="#14B8A6" stroke-width="8" stroke-linecap="round"/><circle cx="34" cy="-99" r="5.4" fill="%s"/></g>'%(SK,SK)
    o+='<circle cx="0" cy="-112" r="9" fill="#6B3E26"/><path d="M-16 -92Q-16 -116 0 -116Q16 -116 16 -92Q8 -102 0 -102Q-8 -102 -16 -92z" fill="#6B3E26"/>'+face(-92).replace('<circle cx="-9"','<circle cx="-9"')
    return o
def wolf(grin=True,cap=False):
    o='<g class="sb-wag"><path d="M-62 -24Q-92 -34 -90 -62Q-80 -46 -56 -40z" fill="#8D98AB" stroke="#5B6579" stroke-width="2.4" stroke-linejoin="round"/></g>'
    o+='<ellipse cx="-34" cy="-22" rx="40" ry="24" fill="#8D98AB" stroke="#5B6579" stroke-width="2.4"/><rect x="-60" y="-8" width="12" height="10" rx="5" fill="#7B869A"/><rect x="-26" y="-8" width="12" height="10" rx="5" fill="#7B869A"/>'
    o+='<path d="M-6 -62L-2 -92L16 -70z" fill="#8D98AB" stroke="#5B6579" stroke-width="2.4" stroke-linejoin="round"/><path d="M-2 -76L0 -86L8 -74z" fill="#F4B3C0"/><path d="M22 -66L34 -92L44 -64z" fill="#8D98AB" stroke="#5B6579" stroke-width="2.4" stroke-linejoin="round"/><path d="M29 -70L34 -84L38 -68z" fill="#F4B3C0"/>'
    o+='<ellipse cx="14" cy="-44" rx="34" ry="30" fill="#8D98AB" stroke="#5B6579" stroke-width="2.4"/><ellipse cx="36" cy="-36" rx="20" ry="14" fill="#B8C1D0" stroke="#5B6579" stroke-width="2.4"/><circle cx="52" cy="-42" r="5.4" fill="#1F2937"/>'
    o+='<g class="sb-blink"><ellipse cx="22" cy="-54" rx="6" ry="6.5" fill="#FDE047" stroke="#5B6579" stroke-width="1.8"/><circle cx="24" cy="-54" r="2.8" fill="#1F2937"/></g><path d="M12 -64Q22 -70 30 -62" stroke="#5B6579" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    if grin: o+='<path d="M26 -30Q40 -22 54 -32" stroke="#1F2937" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M34 -28l3 6 3 -6M44 -30l3 5 3 -6" fill="#fff" stroke="#1F2937" stroke-width="1.6" stroke-linejoin="round"/>'
    if cap: o+='<path d="M-6 -76Q14 -102 40 -76Q14 -82 -6 -76z" fill="#fff" stroke="#CBD5E1" stroke-width="2"/><circle cx="14" cy="-96" r="5" fill="#F9A8D4"/>'
    return o
def grandma():
    o=f'<circle cx="0" cy="-60" r="9" fill="#CBD5E1"/><path d="M-17 -34Q-17 -64 0 -64Q17 -64 17 -34Q8 -48 0 -48Q-8 -48 -17 -34z" fill="#CBD5E1" stroke="#94A3B8" stroke-width="2"/><ellipse cx="0" cy="-30" rx="15" ry="16" fill="{SK}"/>'
    o+='<g class="sb-blink"><circle cx="-5" cy="-32" r="2" fill="#3B2412"/><circle cx="5" cy="-32" r="2" fill="#3B2412"/></g><g fill="none" stroke="#7C4A1E" stroke-width="1.8"><circle cx="-5.5" cy="-32" r="5.6"/><circle cx="5.5" cy="-32" r="5.6"/><path d="M0 -32h0"/></g><path d="M-4 -24q4 4 8 0" stroke="#B4533A" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="-10" cy="-26" r="2.6" fill="#F59DA0" opacity=".7"/><circle cx="10" cy="-26" r="2.6" fill="#F59DA0" opacity=".7"/>'
    o+='<path d="M-24 0Q-24 -14 0 -14Q24 -14 24 0z" fill="#A78BFA" stroke="#7C5CE0" stroke-width="2"/>'
    return o
def woodcutter():
    o='<rect x="-10" y="-30" width="8" height="30" rx="3" fill="#6B4A2B"/><rect x="3" y="-30" width="8" height="30" rx="3" fill="#6B4A2B"/><ellipse cx="-8" cy="0" rx="10" ry="5" fill="#3F2A16"/><ellipse cx="9" cy="0" rx="10" ry="5" fill="#3F2A16"/>'
    o+='<path d="M-22 -28L-17 -78Q0 -86 17 -78L22 -28z" fill="#D14343" stroke="#8F1F1F" stroke-width="2" stroke-linejoin="round"/><path d="M-10 -78V-30M0 -80V-28M10 -78V-30M-20 -52H20" stroke="#8F1F1F" stroke-width="2" opacity=".5"/>'
    o+='<g transform="rotate(-24 20 -70)"><rect x="18" y="-118" width="5" height="64" rx="2.5" fill="#8A5A2B"/><path d="M23 -116Q44 -114 44 -98Q34 -96 23 -102z" fill="#CBD5E1" stroke="#64748B" stroke-width="2"/></g><path d="M16 -74L32 -62" stroke="#D14343" stroke-width="8" stroke-linecap="round"/><circle cx="33" cy="-60" r="5" fill="%s"/><path d="M-16 -74L-26 -50" stroke="#D14343" stroke-width="8" stroke-linecap="round"/><circle cx="-26" cy="-48" r="5" fill="%s"/>'%(SK,SK)
    o+=f'<ellipse cx="0" cy="-92" rx="15" ry="16" fill="{SK}"/><path d="M-15 -88Q0 -60 15 -88Q10 -74 0 -74Q-10 -74 -15 -88z" fill="#8A5A2B"/><circle cx="-5" cy="-96" r="2" fill="#3B2412"/><circle cx="5" cy="-96" r="2" fill="#3B2412"/><path d="M-4 -86q4 3 8 0" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M-20 -100Q0 -122 20 -100z" fill="#2F8F55" stroke="#1F6A3E" stroke-width="2"/><rect x="-22" y="-102" width="44" height="6" rx="3" fill="#1F6A3E"/>'
    return o
def tree(x,y,s=1,c='#3FA55E'):
    return f'<g transform="translate({x} {y}) scale({s})"><rect x="-9" y="-70" width="18" height="70" rx="4" fill="#8A5A2B"/><circle cx="0" cy="-90" r="38" fill="{c}"/><circle cx="-28" cy="-66" r="26" fill="{c}"/><circle cx="28" cy="-66" r="26" fill="{c}"/><circle cx="-8" cy="-100" r="14" fill="#fff" opacity=".12"/></g>'
def bush(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><circle cx="-16" cy="-12" r="16" fill="#46B56A"/><circle cx="10" cy="-16" r="20" fill="#3FA55E"/><circle cx="30" cy="-8" r="13" fill="#46B56A"/></g>'
def flower(x,y,c='#F472B6',s=1,sway=True,d=0):
    return f'<g transform="translate({x} {y}) scale({s})"><g class="{"sb-sway" if sway else ""}" style="animation-delay:{d}s"><path d="M0 0V-28" stroke="#2F8F55" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="-32" r="8" fill="{c}"/><circle cx="0" cy="-32" r="3.4" fill="#FDE047"/><path d="M0 -10Q8 -16 12 -12Q6 -6 0 -10z" fill="#46B56A"/></g></g>'
def sky(): return '<rect width="480" height="300" fill="#BFE6FB"/><circle cx="420" cy="52" r="26" fill="#FFD43B"/><path d="M40 60a14 14 0 010-28 18 18 0 0134-4 16 16 0 0124 10 13 13 0 01-2 22z" fill="#fff" opacity=".9"/>'
def meadow(): return sky()+'<path d="M0 190Q120 160 240 182T480 170V300H0z" fill="#7BCB6B"/><path d="M0 230Q140 206 280 226T480 214V300H0z" fill="#5FC77E"/>'
def forest_bg():
    return ('<rect width="480" height="300" fill="#CFEFD8"/><path d="M0 200Q120 176 240 196T480 184V300H0z" fill="#6FC47A"/><path d="M0 240Q140 218 280 236T480 226V300H0z" fill="#58B66A"/>'+tree(60,200,.8,'#2F8F55')+tree(420,196,.9,'#2F8F55')+tree(250,180,.6,'#3FA55E'))
def room_bg(wall='#FFE9CF',floor='#D9B88E'):
    return f'<rect width="480" height="300" fill="{wall}"/><rect y="236" width="480" height="64" fill="{floor}"/><rect y="230" width="480" height="8" fill="#C9A173"/><rect x="48" y="52" width="92" height="82" rx="8" fill="#fff"/><rect x="55" y="59" width="78" height="68" rx="3" fill="#BFE4F8"/><path d="M94 59V127M55 93H133" stroke="#fff" stroke-width="4"/>'
def bubble(x,y,w,h,inner,d=0,tail='l'):
    tx='M14 %d l-12 10 l22 -6z'%(h-6) if tail=='l' else 'M%d %d l12 10 l-22 -6z'%(w-14,h-6)
    return f'<g transform="translate({x} {y})"><g class="sb-pop" style="--d:{d}s"><rect width="{w}" height="{h}" rx="16" fill="#fff" stroke="#E0E7F5" stroke-width="2"/><path d="{tx}" fill="#fff"/>{inner}</g></g>'
def basket_big(x,y,s=1): return f'<g transform="translate({x} {y}) scale({s})"><path d="M-34 -6h68l-9 46h-50z" fill="#D69048" stroke="#9A5B1E" stroke-width="3" stroke-linejoin="round"/><path d="M-26 8h52M-24 22h48" stroke="#9A5B1E" stroke-width="2.4" opacity=".6"/><path d="M-26 -6Q0 -56 26 -6" fill="none" stroke="#9A5B1E" stroke-width="5" stroke-linecap="round"/></g>'
def i_bear(s=1): return f'<g transform="scale({s})"><circle cx="-14" cy="-14" r="7" fill="#B9794A"/><circle cx="14" cy="-14" r="7" fill="#B9794A"/><circle cx="0" cy="0" r="17" fill="#C98B58"/><ellipse cx="0" cy="5" rx="8" ry="6.4" fill="#F3D2AE"/><circle cx="-6" cy="-3" r="2.2" fill="#3B2412"/><circle cx="6" cy="-3" r="2.2" fill="#3B2412"/><circle cx="0" cy="3" r="2.6" fill="#3B2412"/></g>'
def i_flowers(s=1): return f'<g transform="scale({s})"><path d="M-8 4L0 26M8 4L0 26M0 -2V26" stroke="#2F8F55" stroke-width="3" stroke-linecap="round"/><circle cx="-10" cy="0" r="7" fill="#F472B6"/><circle cx="10" cy="0" r="7" fill="#C084FC"/><circle cx="0" cy="-8" r="8" fill="#FBBF24"/><circle cx="0" cy="-8" r="3" fill="#fff"/><path d="M-9 24h18l-3 8h-12z" fill="#60A5FA"/></g>'
def i_cookie(s=1): return f'<g transform="scale({s})"><circle cx="0" cy="0" r="16" fill="#E9B26E" stroke="#B45309" stroke-width="2.4"/><circle cx="-6" cy="-5" r="2.8" fill="#5B2A0E"/><circle cx="6" cy="-3" r="2.8" fill="#5B2A0E"/><circle cx="0" cy="7" r="2.8" fill="#5B2A0E"/><circle cx="-8" cy="6" r="2.2" fill="#5B2A0E"/></g>'
def i_rock(s=1): return f'<g transform="scale({s})"><path d="M-22 14L-14 -10L6 -18L22 -4L24 14z" fill="#9AA3B2" stroke="#64748B" stroke-width="2.4" stroke-linejoin="round"/><path d="M-6 -8L8 -12L12 -2" fill="none" stroke="#fff" stroke-width="3" opacity=".5" stroke-linecap="round"/></g>'
def i_shoe(s=1): return f'<g transform="scale({s})"><path d="M-22 6L-18 -12L-6 -12L-4 -4L14 2Q24 4 24 12L-22 12z" fill="#8A5A3C" stroke="#5B3A22" stroke-width="2.4" stroke-linejoin="round"/><rect x="-22" y="10" width="46" height="6" rx="3" fill="#3F2A16"/></g>'
# ---------------- the nine scenes ----------------
def s1():
    it=lambda inner,x,y,dx,dy,d: f'<g transform="translate({x} {y})"><g class="sb-in" style="--dx:{dx}px;--dy:{dy}px;--d:{d}s">{inner}</g></g>'
    return (room_bg()+'<rect x="240" y="170" width="190" height="14" rx="6" fill="#B9784A"/><rect x="256" y="184" width="12" height="52" fill="#9A6236"/><rect x="402" y="184" width="12" height="52" fill="#9A6236"/>'+basket_big(335,166,.9)
            +it(i_bear(1.1),308,142,-170,-20,.2)+it(i_flowers(1.1),338,134,-60,-70,1.0)+it(i_cookie(1.2),366,150,40,-90,1.8)
            +T(130,262,1.25,False,red('up',False),'sb-bob'))
def s2():
    heart='<path d="M62 30C62 22 50 20 50 30C50 38 62 44 62 44C62 44 74 38 74 30C74 20 62 22 62 30z" fill="#F472B6"/>'
    path='<path d="M20 52Q40 30 62 44T104 30" fill="none" stroke="#D9B88E" stroke-width="7" stroke-linecap="round" stroke-dasharray="2 12"/><path d="M96 24l12 6-10 8" fill="none" stroke="#14B8A6" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>'
    return (room_bg()+T(120,262,1.3,False,mom(),'')+T(330,262,1.2,True,red('down',True),'sb-bob')+bubble(150,34,130,66,path+'',0.4,'l')+f'<g transform="translate(60 90)"><g class="sb-rise" style="--d:1s">{heart}</g></g><g transform="translate(96 100) scale(.7)"><g class="sb-rise" style="--d:2s">{heart}</g></g>')
def s3():
    sign='<g transform="translate(250 172)"><rect x="-4" y="-40" width="8" height="46" fill="#8A5A2B"/><path d="M4 -40h40l8 8l-8 8h-40z" fill="#FBBF24" stroke="#B97A00" stroke-width="2"/><path d="M-4 -22h-40l-8 8l8 8h40z" fill="#fff" stroke="#94A3B8" stroke-width="2"/><path d="M14 -32h22M-14 -14h-22" stroke="#B97A00" stroke-width="3" stroke-linecap="round"/></g>'
    return (forest_bg()+'<path d="M-10 262Q140 234 250 214Q330 202 330 176Q330 168 340 166" fill="none" stroke="#E8CFA1" stroke-width="30" stroke-linecap="round"/><path d="M250 214Q300 232 360 262L420 300" fill="none" stroke="#C9A173" stroke-width="22" stroke-linecap="round" opacity=".8"/>'
            +'<g transform="translate(386 158)"><rect x="-26" y="-34" width="52" height="38" fill="#FDE9CF" stroke="#C9A173" stroke-width="2"/><path d="M-32 -32L0 -62L32 -32z" fill="#E5484D" stroke="#B91C2C" stroke-width="2" stroke-linejoin="round"/><rect x="-6" y="-18" width="12" height="22" fill="#8A5A2B"/></g>'+sign
            +'<g class="sb-twinkle" style="--d:0s"><path d="M338 196l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFD43B"/></g>'
            +'<g style="--x0:20px;--x1:210px" class="sb-walk"><g transform="translate(60 258) scale(1.15)"><g class="sb-step">'+red('down',True)+'</g></g></g>')
def s4():
    return (forest_bg()+tree(330,226,1.5,'#2F8F55')
            +'<g transform="translate(330 214)"><g class="sb-peek"><g transform="scale(-.9 .9)">'+wolf()+'</g></g></g>'
            +tree(380,236,1.0,'#2F8F55')[:0]+T(130,262,1.25,False,red('stop',True,'worry'),'sb-bob')
            +bubble(170,48,110,66,'<text x="55" y="50" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="44" fill="#F59E0B">?</text>',.8,'l'))
def s5():
    fl=''.join(flower(x,y,c,s,True,d) for x,y,c,s,d in [(50,262,'#F472B6',1.2,0),(96,276,'#FBBF24',1,.4),(190,270,'#C084FC',1.1,.8),(300,268,'#F472B6',1.2,.2),(350,282,'#FBBF24',1,.6),(420,264,'#60A5FA',1.2,1),(460,280,'#F472B6',1,.3),(150,284,'#FB923C',1,.5)])
    bf='<g class="sb-fly"><g transform="translate(270 150)"><path d="M0 0Q-12 -16 -18 -4Q-12 6 0 0zM0 0Q12 -16 18 -4Q12 6 0 0z" fill="#38BDF8"/><circle cx="0" cy="0" r="2.4" fill="#1F2937"/></g></g>'
    return meadow()+fl+bf+T(240,246,1.3,False,red('up',True),'sb-bob')+'<g class="sb-twinkle" style="--d:.5s"><path d="M120 150l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#fff"/></g>'
def s6():
    bed=('<rect x="230" y="150" width="210" height="96" rx="12" fill="#fff" stroke="#E0E7F5" stroke-width="3"/><rect x="214" y="110" width="26" height="136" rx="8" fill="#8B5A3C"/><rect x="258" y="196" width="190" height="52" rx="12" fill="#A78BFA"/>')
    rings=''.join(f'<g transform="translate({x} {y})"><g class="sb-ring" style="--d:{d}s"><circle r="22" fill="none" stroke="#FFD43B" stroke-width="5"/></g></g>' for x,y,d in [(286,104,.4),(318,116,1.4),(332,134,2.4)])
    return (room_bg('#EDE6FF','#C9B6F0')+bed+'<g transform="translate(300 196) scale(1.1)">'+'<g transform="scale(.8)">'+wolf(True,True)+'</g></g>'+'<path d="M258 200Q300 190 440 200V248H258z" fill="#A78BFA"/>'+rings+T(130,262,1.25,False,red('down',True,'worry'),'sb-bob'))
def s7():
    shout=('<text x="60" y="44" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="26" fill="#E5484D">HELP!</text>')
    birds=''.join(f'<g class="sb-fly" style="animation-delay:{d}s"><path d="M{x} {y}q8 -10 16 0q8 -10 16 0" fill="none" stroke="#475569" stroke-width="3" stroke-linecap="round"/></g>' for x,y,d in [(60,70,0),(120,50,.8)])
    return (forest_bg()+birds+T(120,262,1.3,False,red('up',True,'open'),'sb-bob')+bubble(150,44,124,64,shout,.4,'l')+'<g transform="translate(362 258) scale(1.2)"><g class="sb-run"><g class="sb-step">'+woodcutter()+'</g></g></g>')
def s8():
    hearts=''.join(f'<g transform="translate({x} 150)"><g class="sb-rise" style="--d:{d}s"><path d="M0 8C0 0 -12 -2 -12 8C-12 16 0 22 0 22C0 22 12 16 12 8C12 -2 0 0 0 8z" fill="#F472B6"/></g></g>' for x,d in [(200,0),(250,.8),(290,1.6)])
    ward=('<rect x="330" y="70" width="110" height="168" rx="10" fill="#B9784A" stroke="#8B5A3C" stroke-width="3"/><rect x="340" y="82" width="42" height="146" rx="4" fill="#E9C9A0"/><g transform="translate(396 156)"><rect x="0" y="-74" width="36" height="146" rx="4" fill="#E9C9A0"/></g>')
    return (room_bg('#FFF1DB')+ward+'<g class="sb-bob">'+f'<g transform="translate(360 230) scale(1.05)">{grandma()}</g></g>'+T(250,262,1.25,False,red('up',False),'sb-bob')+hearts+'<g class="sb-twinkle" style="--d:0s"><path d="M70 170l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFD43B"/></g>')
def s9():
    def card(x,d,col,inner,t): return f'<g transform="translate({x} 62) scale(.9)"><g class="sb-flip" style="--d:{d}s"><rect width="120" height="150" rx="18" fill="#fff" stroke="{col}" stroke-width="5"/>{inner}<text x="60" y="132" text-anchor="middle" font-family="Poppins" font-weight="800" font-size="13" fill="#1B2B6B">{t}</text></g></g>'
    c1='<path d="M20 100Q40 40 60 70T100 30" fill="none" stroke="#D9B88E" stroke-width="12" stroke-linecap="round"/><path d="M92 18l14 8-12 10" fill="none" stroke="#14B8A6" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'
    c2='<circle cx="60" cy="56" r="24" fill="#F6D2B0"/><circle cx="52" cy="52" r="3" fill="#3B2412"/><circle cx="68" cy="52" r="3" fill="#3B2412"/><path d="M50 66h20" stroke="#B4533A" stroke-width="3" stroke-linecap="round"/><path d="M30 96L90 24" stroke="#FB923C" stroke-width="7" stroke-linecap="round"/>'
    c3='<circle cx="60" cy="40" r="14" fill="#F6D2B0"/><path d="M36 92Q60 52 84 92z" fill="#6366F1"/><path d="M84 66l16 -14" stroke="#F6D2B0" stroke-width="8" stroke-linecap="round"/>'
    sp=''.join(f'<g class="sb-twinkle" style="--d:{d}s"><path d="M{x} {y}l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFD43B"/></g>' for x,y,d in [(40,50,0),(440,44,.6),(430,230,1.2),(50,236,.3)])
    return (sky().replace('fill="#BFE6FB"','fill="#DDEBFF"')+'<path d="M0 250Q120 226 240 246T480 236V300H0z" fill="#7BCB6B"/>'+card(34,.2,'#14B8A6',c1,'Stay on the path')+card(148,.9,'#FB923C',c2,'No strangers')+card(262,1.6,'#6366F1',c3,'Tell a grown-up')+sp+T(428,262,1.0,True,red('up',True),'sb-bob'))
SCENES=[s1,s2,s3,s4,s5,s6,s7,s8,s9]
def scene(i,w='100%',h='100%',extra=''):
    return f'<svg class="sb" viewBox="0 0 480 300" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" style="display:block;{extra}"><style>{KF}</style>{SCENES[i]()}</svg>'
if __name__=='__main__':
    from playwright.sync_api import sync_playwright
    h='<body style="margin:0;background:#fff;display:grid;grid-template-columns:repeat(3,480px);gap:6px">'+''.join(scene(i,480,300) for i in range(9))+'</body>'
    with sync_playwright() as p:
        b=p.chromium.launch();pg=b.new_page(viewport={'width':1460,'height':920});pg.set_content(h);pg.wait_for_timeout(300)
        pg.evaluate("document.getAnimations().forEach(a=>{a.pause();a.currentTime=4200})");pg.screenshot(path='/tmp/scenes.png');b.close()
