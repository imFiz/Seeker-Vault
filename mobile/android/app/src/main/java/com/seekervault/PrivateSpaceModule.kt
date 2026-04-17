package com.seekervault

import android.app.admin.DevicePolicyManager
import android.content.Context
import android.os.Build
import android.os.UserManager
import android.os.UserHandle
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class PrivateSpaceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "PrivateSpaceModule"
    }

    @ReactMethod
    fun lockPrivateSpace(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 35) { // Android 15 (Vanilla Ice Cream)
                val userManager = reactApplicationContext.getSystemService(Context.USER_SERVICE) as UserManager
                val profiles = userManager.userProfiles
                
                var locked = false
                for (profile in profiles) {
                    // Identify the managed/private profile
                    if (userManager.isManagedProfile(profile.identifier)) {
                        // Request Quiet Mode (Locks the profile)
                        userManager.requestQuietModeEnabled(true, profile)
                        locked = true
                    }
                }
                
                if (locked) {
                    promise.resolve(true)
                } else {
                    promise.reject("NO_PROFILE", "No managed/private profile found on this device.")
                }
            } else {
                promise.reject("UNSUPPORTED_VERSION", "Private Space API requires Android 15+ (API 35).")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }

    @ReactMethod
    fun unlockPrivateSpace(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= 35) {
                val userManager = reactApplicationContext.getSystemService(Context.USER_SERVICE) as UserManager
                val profiles = userManager.userProfiles
                
                var unlocked = false
                for (profile in profiles) {
                    if (userManager.isManagedProfile(profile.identifier)) {
                        // Disable Quiet Mode (Unlocks the profile)
                        userManager.requestQuietModeEnabled(false, profile)
                        unlocked = true
                    }
                }
                
                if (unlocked) {
                    promise.resolve(true)
                } else {
                    promise.reject("NO_PROFILE", "No managed/private profile found on this device.")
                }
            } else {
                promise.reject("UNSUPPORTED_VERSION", "Private Space API requires Android 15+ (API 35).")
            }
        } catch (e: Exception) {
            promise.reject("ERROR", e.message)
        }
    }
}
