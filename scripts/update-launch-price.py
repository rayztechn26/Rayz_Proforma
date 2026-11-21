from pathlib import Path
import argparse

ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Update activation-price copy without changing sample invoice line items.')
parser.add_argument('--old',type=int,default=3000)
parser.add_argument('--new',type=int,default=1000)
args=parser.parse_args()
assert 0<args.old<1000000000 and 0<args.new<1000000000
old,new=f'{args.old:,}',f'{args.new:,}'
paths=[ROOT/'scripts/launch-content.json',ROOT/'scripts/build-launch-pack.py',ROOT/'scripts/package-rayz-services.py',ROOT/'docs/PAYMENT-INSTRUCTIONS.txt',Path('D:/xampp/htdocs/rayztech/src/components/site/ProformaStudioProduct.tsx')]
for p in paths:
    s=p.read_text(encoding='utf-8-sig')
    p.write_text(s.replace(f'ETB {old}',f'ETB {new}').replace(f'{old} ብር',f'{new} ብር'),encoding='utf-8')
p=ROOT/'scripts/launch-preview.cjs'
p.write_text(p.read_text(encoding='utf-8-sig').replace(f"fee:'{args.old}.00'",f"fee:'{args.new}.00'"),encoding='utf-8')
print('Updated current activation-price copy and screenshot fixtures; sample invoice line prices are unchanged.')
