package com.solaris.opensource

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.Locale

@InvokeArg
class LaunchPackageArgs {
    lateinit var packageName: String
    var fallbackUrl: String? = null
}

@InvokeArg
class OpenUrlArgs {
    lateinit var url: String
}

@TauriPlugin
class LaunchPlugin(private val activity: Activity) : Plugin(activity) {
    private fun start(intent: Intent?) {
        if (intent == null) return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    @Command
    fun launchPackage(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val packageManager = activity.packageManager
        var intent = packageManager.getLaunchIntentForPackage(args.packageName)

        if (intent == null && !args.fallbackUrl.isNullOrEmpty()) {
            intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.fallbackUrl))
        }

        val result = JSObject()
        if (intent == null) {
            result.put("ok", false)
            invoke.resolve(result)
            return
        }

        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "launch failed")
            return
        }
        invoke.resolve(result)
    }

    @Command
    fun openUrl(invoke: Invoke) {
        val args = invoke.parseArgs(OpenUrlArgs::class.java)
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.url))
        val result = JSObject()
        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            invoke.reject(error.message ?: "open url failed")
            return
        }
        invoke.resolve(result)
    }

    private fun iconToBase64(packageName: String, packageManager: PackageManager): String? {
        return try {
            val drawable = packageManager.getApplicationIcon(packageName)
            val size = 48
            val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            bitmap.recycle()
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (error: Exception) {
            null
        }
    }

    @Command
    fun listInstalledApps(invoke: Invoke) {
        val packageManager = activity.packageManager
        val launcherIntent = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
        val resolved = packageManager.queryIntentActivities(launcherIntent, 0)
        val seen = HashSet<String>()
        val items = mutableListOf<Pair<String, JSONObject>>()

        for (info in resolved) {
            val packageName = info.activityInfo?.packageName ?: continue
            if (packageName == activity.packageName || !seen.add(packageName)) continue
            val item = JSONObject()
            item.put("name", info.loadLabel(packageManager).toString())
            item.put("packageName", packageName)
            val icon = iconToBase64(packageName, packageManager)
            if (icon != null) item.put("icon", icon)
            items.add(Pair(info.loadLabel(packageManager).toString(), item))
        }

        items.sortBy { it.first.lowercase(Locale.getDefault()) }
        val array = JSONArray()
        for (entry in items) array.put(entry.second)

        val result = JSObject()
        result.put("apps", array)
        invoke.resolve(result)
    }

    @Command
    fun isInstalled(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val intent = activity.packageManager.getLaunchIntentForPackage(args.packageName)
        val result = JSObject()
        result.put("installed", intent != null)
        invoke.resolve(result)
    }
}
