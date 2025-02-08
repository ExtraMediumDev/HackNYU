document.addEventListener("DOMContentLoaded", () => {
    // Add modal HTML to the page
    const modalHTML = `
          <div class="modal-overlay" id="webcamModal">
              <div class="spotify-player">
                  <button class="close-button">&times;</button>
                  <div class="webcam-section">
                      <video id="video" autoplay style="display: none;"></video>
                      <canvas id="canvas" style="display: none;"></canvas>
                      <img id="result" alt="Prediction Result" />
                  </div>
                  <div class="metrics-section">
                      <div class="metrics-title">Stress Level</div>
                      <div id="stressPrediction" class="metrics-value">Not measured</div>
                      <div class="metrics-title">Drowsiness Level</div>
                      <div id="drowsinessPrediction" class="metrics-value">Not measured</div>
                      <div id="alerts"></div>
                  </div>
                  <div class="player-controls">
                      <button id="startButton" class="begin-story-btn">Begin Story</button>
                  </div>
              </div>
          </div>
      `
    document.body.insertAdjacentHTML("beforeend", modalHTML)
  
    // Get modal elements
    const modal = document.getElementById("webcamModal")
    const closeButton = modal.querySelector(".close-button")
    const startButton = document.getElementById("startButton")
  
    // Add click handlers to all tiles
    document.querySelectorAll(".tiles article a").forEach((tile) => {
      tile.addEventListener("click", (e) => {
        e.preventDefault()
        modal.classList.add("active")
      })
    })
  
    // Close modal handler
    closeButton.addEventListener("click", () => {
      modal.classList.remove("active")
      stopMonitoring()
    })
  
    // Rest of the webcam functionality remains the same
    const video = document.getElementById("video")
    const canvas = document.getElementById("canvas")
    const resultImg = document.getElementById("result")
    const stressPredictionDiv = document.getElementById("stressPrediction")
    const alertsDiv = document.getElementById("alerts")
    let intervalId = null
  
    let stressConsecutiveCount = 0
    const STRESS_THRESHOLD = 0.7
    const STRESS_CONSECUTIVE_LIMIT = 10
  
    function startMonitoring() {

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            console.log(latitude, longitude);
            },
            (error) => {
            console.error("Error getting location:", error.message);
            }
        );
        } else {
        console.error("Geolocation is not supported by this browser.");
        }

      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          video.srcObject = stream
          video.style.display = "block"
          intervalId = setInterval(captureAndPredict, 500)
          startButton.disabled = true
        })
        .catch((err) => {
          console.error("Error accessing webcam:", err)
        })
    }
  
    function stopMonitoring() {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop())
        video.srcObject = null
      }
      startButton.disabled = false
    }
  
    function captureAndPredict() {
      const context = canvas.getContext("2d")
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
  
      canvas.toBlob((blob) => {
        const formData = new FormData()
        formData.append("image", blob, "frame.jpg")
  
        fetch("/api/predict", {
          method: "POST",
          body: formData,
        })
          .then((response) => response.json())
          .then((data) => {
            if (data.image) {
              resultImg.src = "data:image/jpeg;base64," + data.image
            }
  
            let stressHTML = ""
            let stressConfidence = null
  
            if (data.stress_predictions) {
              if (Array.isArray(data.stress_predictions)) {
                data.stress_predictions.forEach((pred) => {
                  if (pred.class && pred.class.toLowerCase() === "stress") {
                    stressHTML = `${(pred.confidence * 100).toFixed(2)}%`
                    stressConfidence = pred.confidence
                  }
                })
              } else {
                for (const label in data.stress_predictions) {
                  if (label.toLowerCase() === "stress") {
                    const pred = data.stress_predictions[label]
                    stressHTML = `${(pred.confidence * 100).toFixed(2)}%`
                    stressConfidence = pred.confidence
                  }
                }
              }
              stressPredictionDiv.innerHTML = stressHTML || "Not detected"
            }
  
            if (stressConfidence !== null && stressConfidence > STRESS_THRESHOLD) {
              stressConsecutiveCount++
            } else {
              stressConsecutiveCount = 0
            }
  
            if (stressConsecutiveCount >= STRESS_CONSECUTIVE_LIMIT) {
              alertsDiv.innerHTML = '<p class="alert">High stress detected!</p>'
            } else {
              alertsDiv.innerHTML = ""
            }
          })
          .catch((err) => console.error(err))
      }, "image/jpeg")
    }
  
    startButton.addEventListener("click", startMonitoring)
  })
  
  