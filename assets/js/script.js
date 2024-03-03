const fullScreen = document.getElementById('fullScreen');
const fileInput = document.getElementById('fileInput');
const uploadStatus = document.getElementById('uploadStatus');

fullScreen?.addEventListener("drop", onDrop);
fileInput?.addEventListener("change", handleUpload);

function onDrop(event) {
  if (!event) return

  event.preventDefault();
  let files = event.dataTransfer?.files;

  if (!files?.length) return;
  for (let i = 0; i < files.length; i++) {
    uploadImage(files[i]);
  }
}


function handleUpload() {
  const file = fileInput?.files?.[0];
  if (file) uploadImage(file);
}

async function copyImageUrl() {
  const imageUrl = document.getElementById('imageUrl');
  try {
    await navigator.clipboard.writeText(imageUrl.innerHTML);
    document.getElementById('copy').style.display = "none"
    document.getElementById('copied').style.display = "block"
  } catch (error) {
    console.error(error.message);
  }
}

async function recoverCopy() {
  document.getElementById('copy').style.display = "block"
  document.getElementById('copied').style.display = "none"
}

function uploadImage(file) {
  const PROXY_URL="https://web-cors.wangxiui.workers.dev"
  const TARGET_URL="https://telegra.ph"
  const formData = new FormData();
  formData.append('file', file);
  fetch(`${PROXY_URL}/upload?target_url=${TARGET_URL}`, {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      console.log('response:data', data);
      const src = 'https://telegra.ph' + data[0].src;
      if(uploadStatus) {
        setUploadStatus(`
<div class="mx-auto p-4 flex flex-wrap justify-around text-center">
  <div class="relative w-52 h-60 img-card flex flex-col justify-center items-center items-cente border border-gray-200  rounded-lg shadow-md overflow-hidden mb-4 bg-white">
 
  ${
          file.type.startsWith("video")
            ? `<video src="${ src }" class="img-fluid mb-3" controls></video>`
            : `<img src="${ src }" class="w-full flex-1 min-h-0 flex justify-center items-center object-cover w-full h-full" alt="Uploaded Image">`
        }
                
                <div class="w-full flex justify-center items-center space-x-1 px-2 py-1 animate-in slide-in-from-bottom">
                  <span id="imageUrl" class="text-sm inline-block flex-1 truncate">${ src }</span>
                  <div class="input-group-append">
                    <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 shrink-0" type="button" >
                      <svg id="copy" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                           stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-copy " onclick="copyImageUrl()">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2"></rect>
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"></path>
                      </svg>
                      
                      <svg id="copied" class="hidden" xmlns="http://www.w3.org/2000/svg" height="24" viewBox="0 -960 960 960" width="24" onclick="recoverCopy()"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" /></svg>
                    </button>
                  </div>
                </div>
  </div>
</div>
        `)
      }
    })
    .catch(error => {
      setUploadStatus('<div class="alert alert-danger">Upload failed. Please try again.</div>')
    });
}

function setUploadStatus(content) {
  if (uploadStatus) {
    uploadStatus.innerHTML = content
  }
}
