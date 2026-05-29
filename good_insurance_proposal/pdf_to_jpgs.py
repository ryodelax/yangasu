#!/usr/bin/env python3
import sys, os
import Quartz
from Quartz import CoreGraphics as CG

pdf_path = sys.argv[1]
out_prefix = sys.argv[2]
dpi = float(sys.argv[3]) if len(sys.argv) > 3 else 110.0

url = Quartz.CFURLCreateFromFileSystemRepresentation(None, pdf_path.encode("utf-8"), len(pdf_path), False)
doc = CG.CGPDFDocumentCreateWithURL(url)
n = CG.CGPDFDocumentGetNumberOfPages(doc)
print(f"Pages: {n}")

scale = dpi / 72.0
for i in range(1, n+1):
    page = CG.CGPDFDocumentGetPage(doc, i)
    rect = CG.CGPDFPageGetBoxRect(page, CG.kCGPDFMediaBox)
    w = int(rect.size.width * scale)
    h = int(rect.size.height * scale)
    cs = CG.CGColorSpaceCreateDeviceRGB()
    ctx = CG.CGBitmapContextCreate(None, w, h, 8, 0, cs, CG.kCGImageAlphaPremultipliedLast)
    CG.CGContextSetRGBFillColor(ctx, 1, 1, 1, 1)
    CG.CGContextFillRect(ctx, CG.CGRectMake(0, 0, w, h))
    CG.CGContextScaleCTM(ctx, scale, scale)
    CG.CGContextDrawPDFPage(ctx, page)
    img = CG.CGBitmapContextCreateImage(ctx)
    out = f"{out_prefix}-{i:02d}.jpg"
    out_url = Quartz.CFURLCreateFromFileSystemRepresentation(None, out.encode("utf-8"), len(out), False)
    dest = Quartz.CGImageDestinationCreateWithURL(out_url, "public.jpeg", 1, None)
    Quartz.CGImageDestinationAddImage(dest, img, {Quartz.kCGImageDestinationLossyCompressionQuality: 0.85})
    Quartz.CGImageDestinationFinalize(dest)
    print(out)
