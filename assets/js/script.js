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

function copyImageUrl() {
  const imageUrl = document.getElementById('imageUrl');
  imageUrl?.select();
  document.execCommand('copy');
  // navigator.clipboard.writeText(imageUrl.value)
}

function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
    .then(response => response.json())
    .then(data => {
      const src = 'https://telegra.ph' + data[0].src;
      if(uploadStatus) {
        setUploadStatus(
          `<div class="alert alert-success">Upload successful!</div>
                <img src="${src}" class="img-fluid mb-3" alt="Uploaded Image">
                <div class="input-group">
                  <input type="text" class="form-control" id="imageUrl" value="${src}">
                  <div class="input-group-append">
                    <button class="btn btn-outline-secondary" type="button" onclick="copyImageUrl()">Copy URL</button>
                  </div>
                </div>
                ${
                          file.type.startsWith("video")
                            ? `<video src="${src}" class="img-fluid mb-3" controls></video>`
                            : `<img src="${src}" class="img-fluid mb-3" alt="Uploaded Image">`
                        }`
        )
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
