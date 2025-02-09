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
  
    // Webcam functionality remains the same
    const video = document.getElementById("video")
    const canvas = document.getElementById("canvas")
    const resultImg = document.getElementById("result")
    const alertsDiv = document.getElementById("alerts")
    let intervalId = null
  
    function startMonitoring() {
      // Attempt to get geolocation (optional)
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latitude = position.coords.latitude
            const longitude = position.coords.longitude
            console.log(latitude, longitude)
          },
          (error) => {
            console.error("Error getting location:", error.message)
          }
        )
      } else {
        console.error("Geolocation is not supported by this browser.")
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
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
  
      const context = canvas.getContext("2d")
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
  
      canvas.toBlob(
        (blob) => {
          const formData = new FormData()
          formData.append("image", blob, "frame.jpg")
  
          fetch("/api/predict", {
            method: "POST",
            body: formData,
          })
            .then((response) => response.json())
            .then((data) => {
              if (data.image) {
                // Draw bounding box annotated image onto the canvas
                const annotatedImg = new Image()
                annotatedImg.onload = () => {
                  // Hide video feed and show annotated canvas
                  video.style.display = "none"
                  canvas.style.display = "block"
  
                  const ctx = canvas.getContext("2d")
                  ctx.clearRect(0, 0, canvas.width, canvas.height)
                  ctx.drawImage(annotatedImg, 0, 0, canvas.width, canvas.height)
                }
                annotatedImg.src = "data:image/jpeg;base64," + data.image
              }
  
              // Check for any alert flags
              if (data.alerts) {
                let alertsHTML = ""
                if (data.alerts.sleep) {
                  alertsHTML += '<p class="alert">Sleep Alert: Drowsiness detected for consecutive frames!</p>'
                  new Audio("./assets/audio/sleep_alert.mp3").play()
                }
                if (data.alerts.stress) {
                  alertsHTML += '<p class="alert">Stress Alert: High stress detected for consecutive frames!</p>'
                }
                alertsDiv.innerHTML = alertsHTML
              }
            })
            .catch((err) => console.error(err))
        },
        "image/jpeg"
      )
    }
  
    // ------------------------------------------
    // 1) TTS FUNCTION (ElevenLabs)
    // ------------------------------------------
    const apiKey = "sk_c2c3158aff82387b3f2160e08804e478ce239ae30e5f5478" // Use your own if needed
    const voiceId = "21m00Tcm4TlvDq8ikWAM" // Example Voice ID
  
    async function speakText(text) {
      if (!text) {
        console.log("No text provided to speak.")
        return
      }
      try {
        const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": apiKey,
          },
          body: JSON.stringify({
            text: text,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.5,
            },
          }),
        })
  
        if (!response.ok) {
          throw new Error(`TTS request failed with status ${response.status}`)
        }
  
        const audioArrayBuffer = await response.arrayBuffer()
        const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mpeg" })
        const audioUrl = URL.createObjectURL(audioBlob)
  
        return new Promise((resolve) => {
          const audio = new Audio(audioUrl)
          audio.onended = resolve
          audio.onerror = (err) => {
            console.error("Error playing audio:", err)
            resolve()
          }
          audio.play()
        })
      } catch (error) {
        console.error("Error generating/playing TTS:", error)
      }
    }
  
    // ------------------------------------------
    // 2) FETCH QUESTIONS FROM YOUR FLASK ENDPOINT
    // ------------------------------------------
    async function fetchQuestions(text) {
      try {
        const response = await fetch("/api/generate-questions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ text: text }),
        })
  
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }
  
        const data = await response.json()
        return data.questions || []
      } catch (err) {
        console.error("Error fetching questions:", err)
        return []
      }
    }
  
    // ------------------------------------------
    // 3) FETCH SEMANTIC SCORE
    // ------------------------------------------
    async function fetchSemanticScore(correctAnswer, userAnswer) {
      try {
        const response = await fetch("/api/mysemantic-score", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            correct_answer: correctAnswer,
            user_answer: userAnswer,
          }),
        })
  
        if (!response.ok) {
          throw new Error(`Server error: ${response.status}`)
        }
  
        const data = await response.json()
        return data.match // Returns true or false
      } catch (err) {
        console.error("Error fetching semantic score:", err)
        return false
      }
    }
  
    // ------------------------------------------
    // 4) SPEECH RECOGNITION HELPERS
    // ------------------------------------------
    function startListening() {
      return new Promise((resolve, reject) => {
        try {
          const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
          const recognition = new SpeechRecognition()
  
          recognition.continuous = false
          recognition.interimResults = false
          recognition.lang = "en-US"
  
          recognition.onresult = (event) => {
            const spokenText = event.results[0][0].transcript
            console.log("User said:", spokenText)
            resolve(spokenText)
          }
  
          recognition.onerror = (event) => {
            console.error("Speech recognition error:", event.error)
            reject(event.error)
          }
  
          recognition.start()
        } catch (err) {
          console.error("Error initializing speech recognition:", err)
          reject(err)
        }
      })
    }
  
    async function getSpeechInput() {
      try {
        const myText = await startListening()
        console.log("Recognized speech:", myText)
        return myText
      } catch (error) {
        console.error("Error capturing speech:", error)
      }
    }
  
    // ------------------------------------------
    // 5) MAIN STORY FLOW
    // ------------------------------------------
    async function runStoryFlow() {
      try {
        // Hard-coded story; no file upload or PDF reading
        const extractedText = `
          Once upon a time, there was a curious developer named Alex.
          Alex loved to experiment with JavaScript and build interesting web projects.
          One day, Alex discovered a powerful text-to-speech API.
          With it, Alex could bring stories to life and interact with users in a whole new way.
          The end.
        `
        const words = extractedText.split(" ")
        let myStr = ""
        const totalWords = words.length
        const segmentSize = totalWords / 5
        let nextSplit = segmentSize
  
        for (let idx = 0; idx < words.length; idx++) {
          myStr += " " + words[idx]
  
          if (idx + 1 >= Math.floor(nextSplit) && words[idx].includes(".")) {
            console.log(`[Segment] ${myStr.trim()}`)
            await speakText(myStr.trim())
  
            // Get question(s) from server
            const questionAndAnswer = await fetchQuestions(myStr.trim())
            let questionPart, answerPart
  
            // If the question string includes "Answer:", split them out
            // (Otherwise, handle question as-is)
            if (typeof questionAndAnswer === "string" && questionAndAnswer.includes("Answer:")) {
              const parts = questionAndAnswer.split("Answer:")
              questionPart = parts[0].trim()
              answerPart = parts[1].trim()
            } else {
              // If the endpoint returns an array or something else,
              // adapt here as you wish. For simplicity:
              questionPart = questionAndAnswer
              answerPart = "Unknown"
            }
  
            console.log(`[Generated Question] ${questionPart}`)
            await speakText(questionPart)
  
            const userResponse = await getSpeechInput()
            console.log(`[User Response] ${userResponse}`)
  
            const isCorrect = await fetchSemanticScore(answerPart, userResponse)
            let feedback
            if (isCorrect) {
              feedback = "Good Job. You answered correctly."
            } else {
              feedback = `The correct answer was ${answerPart}`
            }
  
            console.log(`[Feedback] ${feedback}`)
            await speakText(feedback)
  
            myStr = ""
            nextSplit += segmentSize
          }
        }
      } catch (err) {
        console.error("Error in the main flow:", err)
      }
    }
  
    // ------------------------------------------
    // HOOK INTO THE "BEGIN STORY" BUTTON
    // ------------------------------------------
    startButton.addEventListener("click", async () => {
      startMonitoring()  // existing webcam logic
      await runStoryFlow() // story reading + Q&A in the background
    })
  })
  