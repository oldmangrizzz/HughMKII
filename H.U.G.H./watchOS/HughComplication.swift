// HughComplication.swift — watchOS
// Watch complications that show H.U.G.H. status at a glance.
// Supports: Circular Small, Modular Small, Modular Large, Utilitarian Small, Graphic Corner, Graphic Circular.

import ClockKit
import SwiftUI

final class HughComplicationDataSource: NSObject, CLKComplicationDataSource {

    // MARK: - Complication Descriptors

    func getComplicationDescriptors(handler: @escaping ([CLKComplicationDescriptor]) -> Void) {
        let descriptor = CLKComplicationDescriptor(
            identifier: "com.grizzlymedicine.hugh.status",
            displayName: "H.U.G.H. Status",
            supportedFamilies: [
                .circularSmall,
                .modularSmall,
                .modularLarge,
                .utilitarianSmall,
                .graphicCorner,
                .graphicCircular,
                .graphicBezel,
            ]
        )
        handler([descriptor])
    }

    // MARK: - Timeline configuration

    func getTimelineEndDate(for complication: CLKComplication, withHandler handler: @escaping (Date?) -> Void) {
        handler(nil) // Always current
    }

    func getPrivacyBehavior(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationPrivacyBehavior) -> Void) {
        handler(.showOnLockScreen)
    }

    // MARK: - Current entry

    func getCurrentTimelineEntry(for complication: CLKComplication, withHandler handler: @escaping (CLKComplicationTimelineEntry?) -> Void) {
        let template = makeTemplate(for: complication.family)
        if let t = template {
            handler(CLKComplicationTimelineEntry(date: Date(), complicationTemplate: t))
        } else {
            handler(nil)
        }
    }

    // MARK: - Template factory

    private func makeTemplate(for family: CLKComplicationFamily) -> CLKComplicationTemplate? {
        // TODO: Read real status from WatchHUGHClient.shared
        let isOnline = true
        let shortText = isOnline ? "ON" : "OFF"
        let statusColor = isOnline ? UIColor.green : UIColor.red

        switch family {

        case .graphicCircular:
            let template = CLKComplicationTemplateGraphicCircularOpenGaugeSimpleText()
            template.centerTextProvider = CLKSimpleTextProvider(text: shortText)
            template.bottomTextProvider = CLKSimpleTextProvider(text: "HUGH")
            template.gaugeProvider = CLKSimpleGaugeProvider(
                style: .fill,
                gaugeColor: statusColor,
                fillFraction: isOnline ? 1.0 : 0.1
            )
            return template

        case .graphicCorner:
            let template = CLKComplicationTemplateGraphicCornerGaugeText()
            template.outerTextProvider = CLKSimpleTextProvider(text: "H.U.G.H.")
            template.gaugeProvider = CLKSimpleGaugeProvider(
                style: .fill,
                gaugeColor: statusColor,
                fillFraction: isOnline ? 1.0 : 0.1
            )
            return template

        case .graphicBezel:
            let circularTemplate = CLKComplicationTemplateGraphicCircularImage()
            circularTemplate.imageProvider = CLKFullColorImageProvider(
                fullColorImage: UIImage(systemName: "waveform.path.ecg") ?? UIImage()
            )
            let template = CLKComplicationTemplateGraphicBezelCircularText()
            template.circularTemplate = circularTemplate
            template.textProvider = CLKSimpleTextProvider(
                text: isOnline ? "H.U.G.H. ONLINE" : "H.U.G.H. OFFLINE",
                shortText: shortText
            )
            return template

        case .modularLarge:
            let template = CLKComplicationTemplateModularLargeStandardBody()
            template.headerTextProvider = CLKSimpleTextProvider(text: "H.U.G.H.")
            template.body1TextProvider = CLKSimpleTextProvider(
                text: isOnline ? "Systems nominal" : "System offline"
            )
            template.body2TextProvider = CLKSimpleTextProvider(text: "HA · CVX · LFM")
            return template

        case .modularSmall:
            let template = CLKComplicationTemplateModularSmallSimpleText()
            template.textProvider = CLKSimpleTextProvider(text: shortText)
            return template

        case .circularSmall:
            let template = CLKComplicationTemplateCircularSmallSimpleText()
            template.textProvider = CLKSimpleTextProvider(text: shortText)
            return template

        case .utilitarianSmall:
            let template = CLKComplicationTemplateUtilitarianSmallFlat()
            template.textProvider = CLKSimpleTextProvider(
                text: isOnline ? "H.U.G.H. ●" : "H.U.G.H. ○",
                shortText: shortText
            )
            return template

        default:
            return nil
        }
    }
}
