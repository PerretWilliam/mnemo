plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

// Single source of truth for the version: version.txt (bumped by release-please).
// Android needs a monotonically increasing integer: 1.2.3 -> 10203.
val appVersion = rootProject.file("version.txt").readText().trim()
val (major, minor, patch) = appVersion.split(".").map { it.toInt() }

android {
    namespace = "com.perretwilliam.flashcards"
    compileSdk = 37

    defaultConfig {
        // Same id and database path as the former Expo app, so an update keeps the user's data.
        applicationId = "com.perretwilliam.flashcards"
        minSdk = 26
        targetSdk = 36
        versionCode = major * 10000 + minor * 100 + patch
        versionName = appVersion
        androidResources.localeFilters += listOf("en", "fr", "es", "de")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"))
            // Signed with the debug key: fine for personal sideloading (see README).
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    buildFeatures { compose = true }

    lint {
        // French treats 0 as singular, like the former Intl.PluralRules-based strings: the {count} placeholder is intended.
        disable += "ImpliedQuantity"
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.appcompat:appcompat:1.8.0") // per-app language (AppCompatDelegate)
    implementation("androidx.navigation:navigation-compose:2.10.2")
    implementation("androidx.webkit:webkit:1.14.0") // WebViewAssetLoader: offline KaTeX assets
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")

    testImplementation("junit:junit:4.13.2")
}
