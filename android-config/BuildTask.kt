import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val projectRoot = File(project.projectDir, rootDirRel).absolutePath

        val nodeCmd = if (Os.isFamily(Os.FAMILY_WINDOWS)) {
            "node.exe"
        } else {
            "node"
        }

        val tauriJs = File(projectRoot, "node_modules/@tauri-apps/cli/tauri.js")

        if (!tauriJs.exists()) {
            throw GradleException(
                "tauri.js not found at ${tauriJs.absolutePath}. " +
                "Did you run 'pnpm install'?"
            )
        }

        runTauriCli(nodeCmd, tauriJs.absolutePath, projectRoot)
    }

    fun runTauriCli(nodePath: String, tauriJsPath: String, workingDirPath: String) {
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")
        val args = mutableListOf(tauriJsPath, "android", "android-studio-script")

        if (project.logger.isEnabled(LogLevel.DEBUG)) {
            args.add("-vv")
        } else if (project.logger.isEnabled(LogLevel.INFO)) {
            args.add("-v")
        }
        if (release) {
            args.add("--release")
        }
        args.add("--target")
        args.add(target)

        project.exec {
            workingDir(workingDirPath)
            executable(nodePath)
            args(args)
        }.assertNormalExitValue()
    }
}