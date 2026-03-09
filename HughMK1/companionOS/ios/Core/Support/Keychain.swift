import Foundation
import Security

enum Keychain {
  static func set(_ value: Data, key: String) {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecValueData as String: value,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
    ]
    SecItemDelete(query as CFDictionary)
    SecItemAdd(query as CFDictionary, nil)
  }

  static func get(_ key: String) -> Data? {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrAccount as String: key,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var out: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &out) == errSecSuccess else {
      return nil
    }
    return out as? Data
  }

  static func setString(_ string: String, key: String) {
    set(Data(string.utf8), key: key)
  }

  static func getString(_ key: String) -> String? {
    guard let data = get(key) else { return nil }
    return String(data: data, encoding: .utf8)
  }
}
