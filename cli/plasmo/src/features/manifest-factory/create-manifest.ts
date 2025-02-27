import { ensureDir, existsSync } from "fs-extra"

import { vLog, wLog } from "@plasmo/utils"

import type { CommonPath } from "~features/extension-devtools/common-path"
import { generateIcons } from "~features/extension-devtools/generate-icons"
import { generateLocales } from "~features/extension-devtools/generate-locales"
import type { TargetData } from "~features/extension-devtools/get-target-data"

import { PlasmoExtensionManifestMV2 } from "./mv2"
import { PlasmoExtensionManifestMV3 } from "./mv3"

export async function createManifest(
  commonPath: CommonPath,
  { browser, manifestVersion }: TargetData
) {
  vLog("Making sure .plasmo exists")
  await ensureDir(commonPath.dotPlasmoDirectory)

  await generateIcons(commonPath)
  await generateLocales(commonPath)

  vLog("Creating Extension Manifest...")
  const manifestData =
    manifestVersion === "mv3"
      ? new PlasmoExtensionManifestMV3(commonPath, browser)
      : new PlasmoExtensionManifestMV2(commonPath, browser)

  await manifestData.updateEnv()
  await manifestData.updatePackageData()

  const { contentIndexList, contentsDirectory, backgroundIndexList } =
    manifestData.projectPath

  const contentIndex = contentIndexList.find(existsSync)
  const backgroundIndex = backgroundIndexList.find(existsSync)

  const hasEntrypoints = await Promise.all([
    manifestData.scaffolder.initTemplateFiles("popup"),
    manifestData.scaffolder.initTemplateFiles("options"),
    manifestData.scaffolder.initTemplateFiles("newtab"),
    manifestData.scaffolder.initTemplateFiles("devtools"),
    manifestData.toggleContentScript(contentIndex, true),
    manifestData.toggleBackground(backgroundIndex, true),
    manifestData.addContentScriptsDirectory(contentsDirectory)
  ])

  if (!hasEntrypoints.includes(true)) {
    wLog(
      "Unable to find any entrypoints. You may end up with an empty extension..."
    )
  }

  const [hasPopup, hasOptions, hasNewtab, hasDevtools] = hasEntrypoints

  manifestData
    .togglePopup(hasPopup)
    .toggleOptions(hasOptions)
    .toggleDevtools(hasDevtools)
    .toggleNewtab(hasNewtab)

  await manifestData.write(true)

  return manifestData
}
