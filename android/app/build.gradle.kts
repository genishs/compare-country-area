plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// 릴리스 서명: SGSHS 공용 업로드 키(alias "upload").
// 키스토어와 비밀번호 파일의 경로를 환경변수 SGSHS_KEYSTORE / SGSHS_KEYSTORE_PW_FILE로 받고,
// 없으면 홈 디렉터리의 keystores/sgshs-upload.jks / sgshs-upload.pass를 쓴다.
// 비밀번호는 파일에서만 읽으므로 이 파일·명령행·빌드 로그에 남지 않는다.
val keystoreHomeDir = File(System.getProperty("user.home"), "keystores")
val releaseKeystore: File =
    System.getenv("SGSHS_KEYSTORE")?.takeIf { it.isNotBlank() }?.let { file(it) }
        ?: File(keystoreHomeDir, "sgshs-upload.jks")
val releaseKeystorePasswordFile: File =
    System.getenv("SGSHS_KEYSTORE_PW_FILE")?.takeIf { it.isNotBlank() }?.let { file(it) }
        ?: File(keystoreHomeDir, "sgshs-upload.pass")
val hasReleaseSigning = releaseKeystore.isFile && releaseKeystorePasswordFile.isFile

// 서명 키가 없으면 릴리스 APK/AAB 빌드를 실패시킨다(무서명 AAB가 조용히 만들어지지 않도록).
// 키 없이 R8 릴리스 빌드를 확인하려면(QA 등) -PallowUnsignedRelease=true를 준다.
val allowUnsignedRelease = providers.gradleProperty("allowUnsignedRelease").orNull == "true"

android {
    namespace = "com.sgshs.pilot.comparecountry"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.sgshs.pilot.comparecountry"
        minSdk = 26
        targetSdk = 36
        versionCode = 3
        versionName = "1.0.2"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                val password = releaseKeystorePasswordFile.readText().trim()
                storeFile = releaseKeystore
                storePassword = password
                keyAlias = "upload"
                keyPassword = password
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            // R8로 코드·리소스를 줄인다. assets/(웹 자산 www)는 리소스 축소 대상이 아니라 그대로 들어간다.
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        // MainActivity가 OSM 타일 요청 User-Agent에 BuildConfig.VERSION_NAME을 쓴다
        buildConfig = true
    }
}

// 릴리스 패키징(assembleRelease → packageRelease, bundleRelease → packageReleaseBundle)이 실행될
// 예정인데 서명 키가 없으면 빌드를 시작하기 전에 멈춘다. 디버그 빌드에는 영향이 없다.
if (!hasReleaseSigning && !allowUnsignedRelease) {
    gradle.taskGraph.whenReady {
        val releasePackaging = setOf("packageRelease", "packageReleaseBundle")
        if (allTasks.any { it.project == project && it.name in releasePackaging }) {
            throw GradleException(
                "Release signing key not found. Set SGSHS_KEYSTORE and SGSHS_KEYSTORE_PW_FILE " +
                    "(or put sgshs-upload.jks / sgshs-upload.pass under ~/keystores), " +
                    "or pass -PallowUnsignedRelease=true to build an unsigned release for testing."
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.webkit:webkit:1.11.0")
    implementation("com.google.android.material:material:1.12.0")
}
