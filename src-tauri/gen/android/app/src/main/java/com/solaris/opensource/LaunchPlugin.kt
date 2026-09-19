package com.solaris.opensource

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.Canvas
import android.net.Uri
import android.util.Base64
import androidx.appcompat.app.AppCompatActivity
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.Invoke
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
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
    // 开源版仅允许 http/https scheme，纵深防御（Rust 已做第一层校验）。
    private val allowedSchemes = setOf("https", "http")

    // IO 协程作用域：主线程外的重任务（应用枚举、图标 Bitmap、Base64）都跑在这里。
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private fun isAllowedScheme(url: String): Boolean {
        return runCatching {
            Uri.parse(url).scheme?.lowercase(Locale.ROOT)
        }.getOrNull() in allowedSchemes
    }

    private fun start(intent: Intent?) {
        if (intent == null) return
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity.startActivity(intent)
    }

    /** 在 Activity 仍存活时 resolve，避免协程完成后 Activity 已销毁的竞态。 */
    private fun resolveSafely(invoke: Invoke, result: JSObject) {
        activity.runOnUiThread {
            if (!activity.isFinishing && !activity.isDestroyed) invoke.resolve(result)
        }
    }

    private fun rejectSafely(invoke: Invoke, message: String) {
        activity.runOnUiThread {
            if (!activity.isFinishing && !activity.isDestroyed) invoke.reject(message)
        }
    }

    @Command
    fun launchPackage(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val packageManager = activity.packageManager
        var intent = packageManager.getLaunchIntentForPackage(args.packageName)

        if (intent == null && !args.fallbackUrl.isNullOrEmpty()) {
            val fallbackUrl = args.fallbackUrl
            if (!isAllowedScheme(fallbackUrl!!)) {
                rejectSafely(invoke, "unsupported url scheme")
                return
            }
            intent = Intent(Intent.ACTION_VIEW, Uri.parse(fallbackUrl))
        }

        val result = JSObject()
        if (intent == null) {
            result.put("ok", false)
            resolveSafely(invoke, result)
            return
        }

        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            rejectSafely(invoke, error.message ?: "launch failed")
            return
        }
        resolveSafely(invoke, result)
    }

    @Command
    fun openUrl(invoke: Invoke) {
        val args = invoke.parseArgs(OpenUrlArgs::class.java)
        if (!isAllowedScheme(args.url)) {
            rejectSafely(invoke, "unsupported url scheme")
            return
        }
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(args.url))
        val result = JSObject()
        try {
            start(intent)
            result.put("ok", true)
        } catch (error: ActivityNotFoundException) {
            result.put("ok", false)
        } catch (error: Exception) {
            rejectSafely(invoke, error.message ?: "open url failed")
            return
        }
        resolveSafely(invoke, result)
    }

    private fun iconToBase64(packageName: String, packageManager: PackageManager): String? {
        val bitmap = try {
            val drawable = packageManager.getApplicationIcon(packageName)
            val size = 48
            val bmp = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bmp)
            drawable.setBounds(0, 0, size, size)
            drawable.draw(canvas)
            bmp
        } catch (error: Exception) {
            return null
        }
        return try {
            val stream = ByteArrayOutputStream()
            bitmap.compress(Bitmap.CompressFormat.PNG, 90, stream)
            Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP)
        } catch (error: Exception) {
            null
        } finally {
            bitmap.recycle()
        }
    }

    @Command
    fun listInstalledApps(invoke: Invoke) {
        scope.launch {
            try {
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
                resolveSafely(invoke, result)
            } catch (error: Exception) {
                rejectSafely(invoke, error.message ?: "list apps failed")
            }
        }
    }

    @Command
    fun isInstalled(invoke: Invoke) {
        val args = invoke.parseArgs(LaunchPackageArgs::class.java)
        val intent = activity.packageManager.getLaunchIntentForPackage(args.packageName)
        val result = JSObject()
        result.put("installed", intent != null)
        invoke.resolve(result)
    }

    override fun onDestroy(activity: AppCompatActivity) {
        scope.cancel()
        super.onDestroy(activity)
    }
}
