#!/usr/bin/env python3
"""Extract anchor-bolt embeds from the SME plan maps.

Anchor map: orange dots = anchor bolts; red text (e.g. 201A, 258A) = type.
We detect the dots, OCR the type labels (tiled), associate each dot to its
nearest label, derive sequence from the mark number, and read the knife-plate
map's coordination table to flag which marks carry a knife plate.

Outputs:
  - /tmp/anchor_assign_overlay.png  (visual QA: dots coloured by sequence)
  - prints per-type and per-sequence counts
  - with --write : replaces embed-tracker/pins in Firebase (one pin per dot)
"""
import cv2, numpy as np, subprocess, re, json, sys, urllib.request, collections

ANCHOR = '/Users/jjiii/embed-tracker/assets/maps/anchor-bolt.png'
KNIFE  = '/Users/jjiii/embed-tracker/assets/maps/knife-plate.png'
BASE   = 'https://gen-lang-client-0119642855-default-rtdb.firebaseio.com/embed-tracker'
LABEL_RE = re.compile(r'^(\d{2,3})\s*A$')

def seq_for(mark):
    """Heuristic sequence from the mark number (2xx=Seq1 confirmed by OCR)."""
    n = int(re.match(r'\d+', mark).group())
    if n < 200: return 'CUP'          # 51A,52A,86A,90A …
    return str(min(4, n // 100 - 1))  # 2xx->1, 3xx->2, 4xx->3, 5xx->4

# ---------- dot detection ----------
def orange_dots(img):
    H, W = img.shape[:2]
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = cv2.inRange(hsv, (8,120,150), (22,255,255))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((5,5), np.uint8))
    n, lab, stats, cent = cv2.connectedComponentsWithStats(m, 8)
    dots = []
    for i in range(1, n):
        a = stats[i, cv2.CC_STAT_AREA]; w = stats[i, cv2.CC_STAT_WIDTH]; h = stats[i, cv2.CC_STAT_HEIGHT]
        if not (2000 <= a <= 5000): continue
        ar = w / h if h else 9
        if not (0.6 <= ar <= 1.6 and a / (w*h) >= 0.55): continue
        x, y = cent[i]
        if x < W*0.16 and y < H*0.30: continue   # skip the legend
        dots.append((float(x), float(y)))
    return dots

# ---------- tiled OCR of the red type labels ----------
def ocr_labels(img):
    H, W = img.shape[:2]
    found = []  # (mark, x, y)
    COLS, ROWS, SC, OV = 5, 4, 2.0, 0.08
    tw, th = W // COLS, H // ROWS
    for r in range(ROWS):
        for c in range(COLS):
            x0 = max(0, int(c*tw - OV*tw)); y0 = max(0, int(r*th - OV*th))
            x1 = min(W, int((c+1)*tw + OV*tw)); y1 = min(H, int((r+1)*th + OV*th))
            tile = cv2.resize(img[y0:y1, x0:x1], None, fx=SC, fy=SC, interpolation=cv2.INTER_CUBIC)
            import os as _o
            tf = f'/tmp/_tile_{r}_{c}.png'
            cv2.imwrite(tf, tile)
            # NOTE: tesseract on this box only resolves the input when run from /tmp
            out = subprocess.run(['tesseract', _o.path.basename(tf), 'stdout','--psm','11','tsv'],
                                 capture_output=True, cwd='/tmp').stdout.decode('utf-8','ignore')
            _o.remove(tf)
            for line in out.splitlines()[1:]:
                f = line.split('\t')
                if len(f) < 12: continue
                txt = f[11].strip().replace(' ', '')
                m = LABEL_RE.match(txt)
                if not m: continue
                try: bx, by, bw, bh = int(f[6]), int(f[7]), int(f[8]), int(f[9])
                except ValueError: continue
                gx = x0 + (bx + bw/2)/SC; gy = y0 + (by + bh/2)/SC
                found.append((m.group(1)+'A', gx, gy))
    # de-dup labels detected in overlapping tiles (same mark within 60px)
    found.sort()
    dedup = []
    for mk, x, y in found:
        if any(mk == m2 and abs(x-x2) < 70 and abs(y-y2) < 70 for m2, x2, y2 in dedup):
            continue
        dedup.append((mk, x, y))
    return dedup

def nearest_label(dot, labels, maxd=420):
    bx = by = None; best = maxd
    for mk, x, y in labels:
        d = ((dot[0]-x)**2 + (dot[1]-y)**2) ** 0.5
        if d < best: best = d; bx = mk
    return bx

# ---------- knife-plate marks (which marks have a knife plate) ----------
def knife_marks(img):
    """OCR the whole knife map; the marks present there are knife-plate bolts."""
    H, W = img.shape[:2]
    return set(m for m, _, _ in ocr_labels(img))

def put(path, data):
    req = urllib.request.Request(f'{BASE}/{path}.json', data=json.dumps(data).encode(),
                                 headers={'Content-Type':'application/json'}, method='PUT')
    return urllib.request.urlopen(req).read()

def main():
    img = cv2.imread(ANCHOR); H, W = img.shape[:2]
    dots = orange_dots(img)
    labels = ocr_labels(img)
    print(f'orange dots: {len(dots)}   labels OCR: {len(labels)}')

    kimg = cv2.imread(KNIFE)
    kmarks = knife_marks(kimg)
    print(f'knife-plate marks (from knife map): {len(kmarks)} → {sorted(kmarks)[:20]}')

    pins = {}
    per_type = collections.Counter()
    per_seq = collections.Counter()
    unassigned = 0
    for i, (x, y) in enumerate(dots):
        mk = nearest_label((x, y), labels)
        if not mk: unassigned += 1
        seq = seq_for(mk) if mk else 'CUP'
        per_type[mk or '??'] += 1; per_seq[seq] += 1
        pins[f'A{i:03d}'] = {
            'embedId': mk or 'UNASSIGNED', 'sequence': seq, 'area': '',
            'mapId': 'anchor', 'x': round(x/W, 5), 'y': round(y/H, 5),
            'installed': False, 'status': 'planned',
            'knifePlate': bool(mk and mk in kmarks),
        }

    print(f'unassigned dots (no label within range): {unassigned}')
    print('per-sequence:', dict(sorted(per_seq.items())))
    print('per-type (top 25):')
    for mk, c in per_type.most_common(25):
        flag = ' [KP]' if mk in kmarks else ''
        print(f'   {mk:6s} {c}{flag}')

    # QA overlay — dots coloured by sequence
    sc = 0.16; small = cv2.resize(img, (int(W*sc), int(H*sc)))
    SEQCOL = {'CUP':(255,255,0),'1':(0,0,255),'2':(0,140,255),'3':(0,255,0),'4':(255,0,255)}
    for p in pins.values():
        col = (180,180,180) if p['embedId']=='UNASSIGNED' else SEQCOL.get(p['sequence'],(255,255,255))
        cv2.circle(small, (int(p['x']*W*sc), int(p['y']*H*sc)), 5, col, 2)
    cv2.imwrite('/tmp/anchor_assign_overlay.png', small)
    print('overlay → /tmp/anchor_assign_overlay.png')

    if '--write' in sys.argv:
        embeds = {mk: {'id': mk, 'seq': seq_for(mk), 'desc': 'Anchor Bolt' + (' + Knife Plate' if mk in kmarks else ''),
                       'qty': c, 'knifePlate': mk in kmarks} for mk, c in per_type.items() if mk != '??'}
        put('embeds', embeds)
        put('pins', pins)
        print(f'WROTE {len(embeds)} embed types + {len(pins)} pins to Firebase')

if __name__ == '__main__':
    main()
