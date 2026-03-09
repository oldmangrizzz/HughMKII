//
//  HomeKitManager.swift
//  H.U.G.H.
//

import Foundation
import HomeKit
import SwiftData

@MainActor
class HomeKitManager: NSObject, ObservableObject {
    static let shared = HomeKitManager()
    
    @Published var homes: [HMHome] = []
    @Published var isAuthorized = false
    @Published var error: Error?
    
    private let manager = HMHomeManager()
    
    private override init() {
        super.init()
        manager.delegate = self
        checkAuthorization()
    }
    
    private func checkAuthorization() {
        // HMHomeManager authorization check
        if manager.homes.isEmpty == false || manager.authorizationStatus != .notAuthorized {
            isAuthorized = true
            homes = manager.homes
        }
    }
    
    func addHome(name: String) async throws {
        try await manager.addHome(withName: name)
    }
    
    func getAccessories() -> [HMAccessory] {
        return homes.flatMap { $0.accessories }
    }
}

extension HomeKitManager: HMHomeManagerDelegate {
    func homeManagerDidUpdateHomes(_ manager: HMHomeManager) {
        self.homes = manager.homes
        self.isAuthorized = true
    }
    
    func homeManager(_ manager: HMHomeManager, didUpdate authorizationStatus: HMHomeManagerAuthorizationStatus) {
        self.isAuthorized = (authorizationStatus == .authorized)
    }
}
