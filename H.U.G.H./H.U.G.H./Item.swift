//
//  Item.swift
//  H.U.G.H.
//
//  Episodic memory anchor with distributed system bindings
//

import Foundation
import SwiftData

@Model
final class Item {
    var timestamp: Date
    var name: String?
    var content: String?
    var tags: [String]?
    
    // External system anchors (distributed identity)
    var proxmoxUUID: String?      // Link to Proxmox MCP
    var homeKitUUID: String?      // Future: stored as string only
    var cloudSyncID: String?      // Future: CloudKit record
    
    // Somatic state
    var isActive: Bool
    var priority: Int
    
    init(
        timestamp: Date = Date(),
        name: String? = nil,
        content: String? = nil,
        tags: [String]? = nil,
        proxmoxUUID: String? = nil,
        isActive: Bool = true,
        priority: Int = 0
    ) {
        self.timestamp = timestamp
        self.name = name
        self.content = content
        self.tags = tags
        self.proxmoxUUID = proxmoxUUID
        self.isActive = isActive
        self.priority = priority
    }
}
