plugins {
    // AGP 9.0+ : 내장 Kotlin 사용(org.jetbrains.kotlin.android 플러그인 불필요),
    // 최적화된 리소스 축소(R8) 대응. compileSdk/targetSdk 36 지원.
    id("com.android.application") version "9.0.1" apply false
}
