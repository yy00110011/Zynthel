# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
# SOLARIS 本地启动插件（JNI 反射实例化，不能被混淆移除）
-keep class com.solaris.personal_terminal.LaunchPlugin { *; }
-keep class com.solaris.personal_terminal.LaunchPackageArgs { *; }
-keep class com.solaris.personal_terminal.OpenUrlArgs { *; }
-keep class app.tauri.** { *; }
