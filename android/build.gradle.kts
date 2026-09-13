plugins {
    // compileSdk/targetSdk 36 요건 반영: AGP 8.5.0은 compileSdk 35까지만 지원하므로
    // compileSdk 36을 지원하는 최소 버전(8.9.1) 이상으로 상향한다.
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "1.9.24" apply false
}
