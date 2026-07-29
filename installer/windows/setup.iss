; CoRead AI — Inno Setup script
; Run from the repo root: iscc /DAppVersion=v1.0.0 installer\windows\setup.iss
; Requires the PyInstaller output to exist at: backend\dist\CoRead\

#ifndef AppVersion
  #define AppVersion "0.0.0"
#endif

[Setup]
AppName=CoRead AI
AppVersion={#AppVersion}
AppPublisher=CoRead
AppPublisherURL=https://github.com/Badistricia/Coread
AppSupportURL=https://github.com/Badistricia/Coread/issues
AppUpdatesURL=https://github.com/Badistricia/Coread/releases
; Install into Program Files
DefaultDirName={autopf}\CoRead AI
DefaultGroupName=CoRead AI
; Uninstall icon points to the main exe
SetupIconFile=..\..\backend\resources\icon.ico
UninstallDisplayIcon={app}\CoRead.exe
; Output
OutputDir=dist
OutputBaseFilename=CoRead-Setup-{#AppVersion}
; Compression
Compression=lzma2/ultra64
SolidCompression=yes
; Visual
WizardStyle=modern
WizardResizable=no
; Don't require admin unless user chooses a system-wide install path
PrivilegesRequiredOverridesAllowed=dialog

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "创建桌面快捷方式"; GroupDescription: "附加选项："; Flags: unchecked

[Files]
; Copy the entire PyInstaller output directory
Source: "..\..\backend\dist\CoRead\*"; \
    DestDir: "{app}"; \
    Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\CoRead AI";                    Filename: "{app}\CoRead.exe"
Name: "{group}\{cm:UninstallProgram,CoRead AI}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CoRead AI";              Filename: "{app}\CoRead.exe"; Tasks: desktopicon

[Run]
; Offer to launch right after installation
Filename: "{app}\CoRead.exe"; \
    Description: "{cm:LaunchProgram,CoRead AI}"; \
    Flags: nowait postinstall skipifsilent
