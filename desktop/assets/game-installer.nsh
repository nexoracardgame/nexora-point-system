!define MUI_BGCOLOR "0B0A09"
!define MUI_TEXTCOLOR "FFFFFF"
!define MUI_INSTFILESPAGE_COLORS "0B0A09 FFFFFF"
!define MUI_PROGRESSBAR "smooth"
!include "nsDialogs.nsh"
!include "FileFunc.nsh"

Var NexoraDialog
Var NexoraImage
Var NexoraImageHandle
Var NexoraButton
Var NexoraButtonHandle
!ifndef BUILD_UNINSTALLER
Var NexoraPath
!endif
Var NexoraFrame
Var NexoraFont

!macro NexoraWelcome PREFIX MODE
Function ${PREFIX}NexoraContinue
  Pop $0
  GetDlgItem $0 $HWNDPARENT 1
  SendMessage $0 ${BM_CLICK} 0 0
FunctionEnd

Function ${PREFIX}NexoraAnimate
  System::Call 'user32::GetCursorPos(*l .r0)'
  System::Call 'user32::WindowFromPoint(l r0) p.r1'
  ${If} $1 == $NexoraButton
    IntOp $NexoraFrame $NexoraFrame + 1
    IntOp $NexoraFrame $NexoraFrame % 16
  ${Else}
    ${If} $NexoraFrame == 0
      Return
    ${EndIf}
    StrCpy $NexoraFrame 0
  ${EndIf}
  ${NSD_FreeImage} $NexoraButtonHandle
  ${NSD_SetStretchedImage} $NexoraButton "$PLUGINSDIR\nexora-${MODE}-$NexoraFrame.bmp" $NexoraButtonHandle
FunctionEnd

Function ${PREFIX}NexoraWelcome
  ${If} ${Silent}
    Abort
  ${EndIf}
  InitPluginsDir
  File /oname=$PLUGINSDIR\nexora-wallpaper.bmp "${BUILD_RESOURCES_DIR}\game-setup\wallpaper.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-0.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-0.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-1.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-1.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-2.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-2.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-3.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-3.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-4.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-4.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-5.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-5.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-6.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-6.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-7.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-7.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-8.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-8.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-9.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-9.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-10.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-10.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-11.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-11.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-12.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-12.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-13.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-13.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-14.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-14.bmp"
  File /oname=$PLUGINSDIR\nexora-${MODE}-15.bmp "${BUILD_RESOURCES_DIR}\game-setup\${MODE}-15.bmp"
  nsDialogs::Create 1044
  Pop $NexoraDialog
  ${If} $NexoraDialog == error
    Abort
  ${EndIf}
  SetCtlColors $NexoraDialog FFFFFF 080B0E
  ${NSD_CreateBitmap} 0 0 100% 100% ""
  Pop $NexoraImage
  ${NSD_SetStretchedImage} $NexoraImage "$PLUGINSDIR\nexora-wallpaper.bmp" $NexoraImageHandle
  CreateFont $NexoraFont "Segoe UI" 18 700
  !if "${MODE}" == "install"
    ${NSD_CreateLabel} 6% 34% 88% 15% "Install NEXORA CARD GAME"
  !else
    ${NSD_CreateLabel} 6% 34% 88% 15% "Uninstall NEXORA CARD GAME?"
  !endif
  Pop $0
  SetCtlColors $0 FFE5A1 transparent
  SendMessage $0 ${WM_SETFONT} $NexoraFont 1
  !if "${MODE}" == "install"
    ${NSD_CreateLabel} 6% 53% 88% 10% "Choose where to install your game."
  !else
    ${NSD_CreateLabel} 6% 53% 88% 10% "Remove the installed game. Your online account and cards stay safe."
  !endif
  Pop $0
  SetCtlColors $0 FFFFFF transparent
  !if "${MODE}" == "install"
    ${NSD_CreateDirRequest} 6% 66% 69% 12% "$INSTDIR"
    Pop $NexoraPath
    SetCtlColors $NexoraPath FFFFFF 101519
    ${NSD_CreateBrowseButton} 77% 66% 17% 12% "Browse..."
    Pop $0
    ${NSD_OnClick} $0 NexoraBrowse
  !else
    ${NSD_CreateLabel} 6% 67% 88% 10% "$INSTDIR"
    Pop $0
    SetCtlColors $0 D1C6AF transparent
  !endif
  ${NSD_CreateBitmap} 61% 82% 33% 14% ""
  Pop $NexoraButton
  ${NSD_AddStyle} $NexoraButton ${SS_NOTIFY}
  ${NSD_OnClick} $NexoraButton ${PREFIX}NexoraContinue
  StrCpy $NexoraFrame 0
  ${NSD_SetStretchedImage} $NexoraButton "$PLUGINSDIR\nexora-${MODE}-0.bmp" $NexoraButtonHandle
  GetDlgItem $0 $HWNDPARENT 1
  !if "${MODE}" == "install"
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Install"
  !else
    SendMessage $0 ${WM_SETTEXT} 0 "STR:Uninstall"
  !endif
  ${NSD_CreateTimer} ${PREFIX}NexoraAnimate 80
  nsDialogs::Show
  ${NSD_KillTimer} ${PREFIX}NexoraAnimate
  ${NSD_FreeImage} $NexoraImageHandle
  ${NSD_FreeImage} $NexoraButtonHandle
  System::Call 'gdi32::DeleteObject(p $NexoraFont)'
FunctionEnd
!macroend

!ifndef BUILD_UNINSTALLER
  !insertmacro NexoraWelcome "" "install"
  Function NexoraBrowse
    Pop $0
    nsDialogs::SelectFolderDialog "Choose game installation folder" "$INSTDIR"
    Pop $0
    ${If} $0 != error
      ${NSD_SetText} $NexoraPath "$0\NEXORA CARD GAME"
    ${EndIf}
  FunctionEnd
  Function NexoraValidatePath
    ${NSD_GetText} $NexoraPath $0
    ${If} $0 == ""
      MessageBox MB_OK|MB_ICONEXCLAMATION "Choose an installation folder."
      Abort
    ${EndIf}
    GetFullPathName $INSTDIR $0
    ${GetRoot} "$INSTDIR" $1
    ${If} $INSTDIR == $1
      MessageBox MB_OK|MB_ICONEXCLAMATION "Choose a game subfolder, not the drive root."
      Abort
    ${EndIf}
  FunctionEnd
  !macro customWelcomePage
    !insertmacro skipPageIfUpdated
    Page custom NexoraWelcome NexoraValidatePath
  !macroend
  !macro customFinishPage
    !define MUI_FINISHPAGE_RUN
    !define MUI_FINISHPAGE_RUN_FUNCTION NexoraStartApp
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW NexoraFinishShow
    !insertmacro MUI_PAGE_FINISH
    Function NexoraStartApp
      ${If} ${isUpdated}
        StrCpy $1 "--updated"
      ${Else}
        StrCpy $1 ""
      ${EndIf}
      ${StdUtils.ExecShellAsUser} $0 "$launchLink" "open" "$1"
    FunctionEnd
    Function NexoraFinishShow
      ; The finish macro declares its controls before this callback uses them.
      StrCpy $0 $mui.FinishPage.Run
      System::Call 'uxtheme::SetWindowTheme(p r0, w "", w "")'
      SetCtlColors $mui.FinishPage.Run FFFFFF 0B0A09
    FunctionEnd
  !macroend
!else
  !insertmacro NexoraWelcome "un." "uninstall"
  !macro customUnWelcomePage
    UninstPage custom un.NexoraWelcome
  !macroend
!endif

!macro customHeader
  BrandingText "NEXORA CARD GAME"
  ShowInstDetails nevershow
  ShowUninstDetails nevershow
!macroend
