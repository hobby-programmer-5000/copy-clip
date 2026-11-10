# Windows용 Copy Clip

[English](WINDOWS.md)

## 실행

x64 ZIP 파일 전체를 한 폴더에 풀고 `CopyClip.exe`를 실행하세요. 앱에는 Microsoft Edge WebView2 Evergreen 런타임이 필요합니다. 런타임이 없다는 안내가 나오면 **Evergreen Bootstrapper**로 설치한 뒤 앱을 다시 여세요. [Microsoft WebView2 다운로드](https://developer.microsoft.com/microsoft-edge/webview2/)

포터블 앱은 Windows 10 22H2 x64에서 테스트했습니다. 운영체제별 지원 범위는 [.NET 10 Windows 지원 표](https://learn.microsoft.com/en-us/dotnet/core/install/windows#supported-versions)를 참고하세요.

## npm으로 소스 실행

[Node.js 22 이상](https://nodejs.org/), [.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0), WebView2 Evergreen 런타임을 설치한 다음 실행하세요.

```powershell
git clone --branch feature/draft-recovery https://github.com/hobby-programmer-5000/copy-clip.git
cd copy-clip
npm install
npm start
```

## 텍스트 복사

1. 왼쪽 위의 **텍스트 편집**을 눌러 내용을 입력하거나 붙여넣으세요. 예를 들어 `Hello!`와 `안녕하세요 📝`를 한 줄씩 넣을 수 있습니다.
2. **적용** 후 **복사**를 누르고, 붙여넣을 앱에서 **Ctrl+V**를 누르세요. 카드에는 최대 8줄이 보이고 긴 줄은 카드 너비에 맞춰 잘립니다. 미리보기에 보이지 않는 부분도 복사됩니다. 아주 긴 텍스트에는 편집이 느려지지 않도록 기본 글자색을 사용합니다.
3. 편집 창의 **예제 사용**으로 예제를 복원할 수 있습니다. 왼쪽 위 메뉴에서 **English**로 전환할 수 있습니다. 오른쪽 위 스피커 버튼은 복사 애니메이션의 효과음을 켜거나 끕니다.

다른 프로그램이 클립보드를 사용 중이면 잠시 기다렸다가 **복사**를 다시 누르세요. 편집 창에서 텍스트를 선택하고 **Ctrl+C**로 복사할 수도 있습니다. 시스템 클립보드와 기록 설정은 Windows에서 관리합니다.

Windows 앱과 위젯에서 작성한 텍스트와 확정한 카드 제목은 자동 저장됩니다. 다음에 앱을 열면 같은 Windows 계정에서 마지막으로 저장된 내용이 복원됩니다. **텍스트 편집** 창에서 적용하기 전에 종료하면 다시 열 때 그 창에서 이어 쓸 수 있습니다. **취소**를 누르면 그 초안을 버리고 기존 카드 내용으로 돌아갑니다.

카드 제목을 클릭해서 이름을 바꿀 수 있습니다. **Enter**를 누르거나 다른 곳을 클릭하면 적용되고, **Esc**를 누르면 취소됩니다. 제목을 비우면 `debounce.js`로 돌아갑니다. 코드를 편집해도 현재 창에서 정한 제목은 유지됩니다.

## 고급

- **언어** 메뉴에서 **앱 표시 언어**와 **코드 언어**를 각각 선택하세요. **시스템 언어**는 Windows판에서 Windows 표시 언어를, 브라우저판에서 브라우저 언어를 따릅니다. 영어, 한국어, 체코어, 독일어, 스페인어, 프랑스어, 이탈리아어, 일본어, 폴란드어, 브라질 포르투갈어, 러시아어, 튀르키예어, 중국어 간체·번체를 지원합니다. 직접 고른 언어는 다음 실행에도 적용됩니다.
- **자동 감지**는 먼저 코드 내용에서 언어 후보를 찾습니다. 카드 제목에 알려진 확장자가 있으면 언어 이름과 구문 강조는 그 확장자를 따릅니다. 예를 들어 `app.py`는 Python, `main.go`는 Go가 적용됩니다. 언어를 직접 선택하면 그 설정이 우선하며, **일반 텍스트**는 카드의 기본 글자색을 사용합니다.
- **고급 → 카드에서 바로 편집**을 켜면 카드에 바로 입력하거나 붙여넣을 수 있습니다. 미리보기의 글꼴, 줄 간격, 줄 번호와 코드 색상이 유지되고, 입력하는 동안 색상이 갱신됩니다. 끄면 현재 내용을 유지한 채 **텍스트 편집 → 적용** 방식으로 돌아갑니다. 새 창에서는 바로 편집이 꺼진 상태로 시작합니다.
- **고급 → 브라우저에서 열기**를 누르면 Windows에서 HTML 파일을 열도록 설정한 브라우저에서 Copy Clip이 열립니다. 브라우저가 로컬 저장을 허용하면, 같은 브라우저 프로필에서 같은 위치의 파일을 다시 열 때 본문, 카드 제목, 미적용 초안이 복원됩니다. 브라우저와 Windows 앱은 각자 초안을 저장합니다. 두 편집기 사이에서 내용을 옮기려면 복사한 뒤 **Ctrl+V**를 누르세요.

- **고급 → 데스크톱 위젯**을 누르면 코드 카드와 나무 클립보드가 다른 창 위에 표시됩니다. 카드에 바로 입력하고 **복사**를 누르세요. 나무 클립보드, 카드 상단의 빈 공간, 배경을 끌어 위젯을 옮길 수 있습니다. 우클릭 메뉴에서 **배경 투명도**를 조절하거나 **일반 창**으로 돌아가거나 앱을 **종료**할 수 있습니다. 둥근 배경은 저장한 설정이 없으면 완전히 투명하게 시작합니다.

## 포터블 빌드

[.NET 10 SDK](https://dotnet.microsoft.com/en-us/download/dotnet/10.0)를 준비한 뒤 저장소 루트에서 실행하세요.

```powershell
dotnet publish windows/CopyClip.csproj -c Release -r win-x64 --self-contained true
```

`windows/bin/Release/net10.0-windows/win-x64/publish/CopyClip.exe`를 실행하세요. 공유할 때는 publish 폴더 전체를 함께 전달하세요. 빌드에는 .NET Desktop Runtime이 포함되며, WebView2 Evergreen 런타임은 Windows에 별도로 설치되어 있어야 합니다.

0.4.9는 SDK 10.0.403으로 빌드했습니다. SDK를 업데이트할 때는 패키지의 런타임 고지를 확인하세요.
