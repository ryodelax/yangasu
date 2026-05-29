import AppKit
import Foundation
import PDFKit
import Vision

struct OCRPage: Codable {
    let page: Int
    let text: String
}

struct OCRDocument: Codable {
    let path: String
    let pageCount: Int
    let pages: [OCRPage]
}

enum OCRScriptError: Error {
    case invalidArguments
    case pdfOpenFailed(String)
    case imageRenderFailed(Int)
}

func renderCGImage(page: PDFPage, scale: CGFloat = 2.0) -> CGImage? {
    let bounds = page.bounds(for: .mediaBox)
    let width = max(Int(bounds.width * scale), 1)
    let height = max(Int(bounds.height * scale), 1)

    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else {
        return nil
    }

    guard let context = CGContext(
        data: nil,
        width: width,
        height: height,
        bitsPerComponent: 8,
        bytesPerRow: 0,
        space: colorSpace,
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
    ) else {
        return nil
    }

    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)))
    context.saveGState()
    context.translateBy(x: 0, y: CGFloat(height))
    context.scaleBy(x: scale, y: -scale)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    return context.makeImage()
}

func recognizeText(cgImage: CGImage) throws -> String {
    let request = VNRecognizeTextRequest()
    request.recognitionLanguages = ["ja-JP", "en-US"]
    request.usesLanguageCorrection = false
    request.recognitionLevel = .accurate
    request.minimumTextHeight = 0.005

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    try handler.perform([request])

    let observations = (request.results ?? []).compactMap { $0 as? VNRecognizedTextObservation }
    let sorted = observations.sorted {
        let ay = $0.boundingBox.maxY
        let by = $1.boundingBox.maxY
        if abs(ay - by) > 0.01 {
            return ay > by
        }
        return $0.boundingBox.minX < $1.boundingBox.minX
    }

    return sorted.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
}

func main() throws {
    let args = CommandLine.arguments
    guard args.count >= 2 else {
        throw OCRScriptError.invalidArguments
    }

    let path = args[1]
    guard let document = PDFDocument(url: URL(fileURLWithPath: path)) else {
        throw OCRScriptError.pdfOpenFailed(path)
    }

    var pages: [OCRPage] = []
    for index in 0..<document.pageCount {
        guard let page = document.page(at: index) else { continue }
        guard let cgImage = renderCGImage(page: page) else {
            throw OCRScriptError.imageRenderFailed(index + 1)
        }
        let text = try recognizeText(cgImage: cgImage)
        pages.append(OCRPage(page: index + 1, text: text))
    }

    let payload = OCRDocument(path: path, pageCount: document.pageCount, pages: pages)
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(payload)
    FileHandle.standardOutput.write(data)
}

do {
    try main()
} catch {
    FileHandle.standardError.write(Data(String(describing: error).utf8))
    exit(1)
}
