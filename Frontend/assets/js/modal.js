document.addEventListener("DOMContentLoaded", () => {
    // ------------------------------------------
    // 1) DYNAMIC MODAL INSERTION (unchanged)
    // ------------------------------------------
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
  
    // ------------------------------------------
    // 2) MODAL ELEMENTS & EVENT HANDLERS
    // ------------------------------------------
    const modal = document.getElementById("webcamModal")
    const closeButton = modal.querySelector(".close-button")
    const startButton = document.getElementById("startButton")
  
    let selectedStoryKey = "" // Will store the key for the chosen story (e.g. "The Great Gatsby")
  
    // Capture the user’s click on each tile
    document.querySelectorAll(".tiles article").forEach((tile) => {
      tile.addEventListener("click", (e) => {
        e.preventDefault()
        // The key must match one in storiesData (loaded via stories.js)
        selectedStoryKey = tile.dataset.storyKey || ""
        modal.classList.add("active")
      })
    })
  
    // Close Modal
    closeButton.addEventListener("click", () => {
      modal.classList.remove("active")
      stopMonitoring()
    })
  
    // ------------------------------------------
    // 3) WEBCAM + PREDICTION LOGIC (unchanged)
    // ------------------------------------------
    const video = document.getElementById("video")
    const canvas = document.getElementById("canvas")
    const resultImg = document.getElementById("result")
    const alertsDiv = document.getElementById("alerts")
    let intervalId = null
  
    function startMonitoring() {
      // Attempt geolocation (optional)
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const latitude = position.coords.latitude
            const longitude = position.coords.longitude
            console.log("Latitude:", latitude, "Longitude:", longitude)
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
                // Show bounding box annotated image
                const annotatedImg = new Image()
                annotatedImg.onload = () => {
                  video.style.display = "none"
                  canvas.style.display = "block"
  
                  const ctx = canvas.getContext("2d")
                  ctx.clearRect(0, 0, canvas.width, canvas.height)
                  ctx.drawImage(annotatedImg, 0, 0, canvas.width, canvas.height)
                }
                annotatedImg.src = "data:image/jpeg;base64," + data.image
              }
  
              // Check alerts
              if (data.alerts) {
                let alertsHTML = ""
                if (data.alerts.sleep) {
                  alertsHTML += '<p class="alert">Sleep Alert: Drowsiness detected!</p>'
                  new Audio("./assets/audio/sleep_alert.mp3").play()
                }
                if (data.alerts.stress) {
                  alertsHTML += '<p class="alert">Stress Alert: High stress detected!</p>'
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
    // 4) TEXT-TO-SPEECH (ElevenLabs)
    // ------------------------------------------
    const apiKey = "sk_c2c3158aff82387b3f2160e08804e478ce239ae30e5f5478" // Replace with your own or hide on server
    const voiceId = "21m00Tcm4TlvDq8ikWAM"
  
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
    // 5) QUESTION GENERATION + SCORING
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
        return data.match // true or false
      } catch (err) {
        console.error("Error fetching semantic score:", err)
        return false
      }
    }
  
    // ------------------------------------------
    // 6) SPEECH RECOGNITION
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
    // 7) MAIN STORY FLOW
    // ------------------------------------------
    async function runStoryFlow(storyKey) {
      if (!storyKey) {
        console.error("No story key provided, or tile was missing data-story-key.")
        return
      }
  
      // 7a) Retrieve the text from storiesData
      const extractedText = storiesData[storyKey] || ""
      if (!extractedText) {
        console.error(`No story text found for key: ${storyKey}`)
        return
      }
  
      try {
        // Segment and read the text
        const words = extractedText.split(" ")
        let currentSegment = ""
        const totalWords = words.length
  
        // We'll break into 5 approximate segments, or whatever logic you prefer
        const segmentSize = totalWords / 5
        let nextSplit = segmentSize
  
        for (let idx = 0; idx < words.length; idx++) {
          currentSegment += " " + words[idx]
  
          // If we've crossed a segment boundary and found a period, speak that chunk
          if (idx + 1 >= Math.floor(nextSplit) && words[idx].includes(".")) {
            console.log(`[Segment] ${currentSegment.trim()}`)
            await speakText(currentSegment.trim())
  
            // Q&A flow
            const questionAndAnswer = await fetchQuestions(currentSegment.trim())
            let questionPart, answerPart
  
            // If the returned question is a string containing "Answer:", split it
            if (typeof questionAndAnswer === "string" && questionAndAnswer.includes("Answer:")) {
              const parts = questionAndAnswer.split("Answer:")
              questionPart = parts[0].trim()
              answerPart = parts[1].trim()
            } else {
              // If we get an array or different structure, handle accordingly
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
  
            // Reset for next chunk
            currentSegment = ""
            nextSplit += segmentSize
          }
        }
      } catch (err) {
        console.error("Error in the main flow:", err)
      }
    }
  
    // ------------------------------------------
    // 8) BEGIN STORY BUTTON
    // ------------------------------------------
    startButton.addEventListener("click", async () => {
      startMonitoring() // start webcam logic
  
      // run the story flow using whichever story was selected
      await runStoryFlow(selectedStoryKey)
    })
  })
  