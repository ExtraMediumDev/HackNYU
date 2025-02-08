from pypdf import PdfReader



from elevenlabs.client import ElevenLabs
from elevenlabs import stream
import openai
from elevenlabs.client import ElevenLabs
import speech_recognition as sr
from sentence_transformers import SentenceTransformer, util 
import os
from dotenv import load_dotenv

# Load environment variables from .env file


class Audiobook:
    """
    An OOP-style class for:
      - Extracting text from a PDF
      - Generating quiz questions (via OpenAI)
      - Performing Speech-to-Text (via speech_recognition)
      - Generating audio (via ElevenLabs)
      - Running a TTS-based 'audiobook quiz' flow.
    """

    def __init__(self, voice: str = "Rachel"):
       

        load_dotenv()

        # openAIKey= os.getenv("OPENAI_KEY")
        # elevenlabs_api_key = os.getenv("elevenlabs_api_key")


        
# elevenlabs_api_key = ""
        self.openAIKey = os.getenv("OPENAI_KEY")
        openai.api_key = self.openAIKey
        self.elevenlabs_key = os.getenv("elevenlabs_api_key")
        self.voice = voice

        # Set OpenAI key globally for convenience
        

        # Pre-load or configure any other resources if needed
        self.sentence_model = SentenceTransformer('all-MiniLM-L6-v2')
        self.message_history = [
            # System message
            {"role": "system", "content": "You are an assistant that generates a simple and very easy to answer quiz question based off a short text that I give you. The answer to your question should be about 1-2 words. I need you to answer in a Question: Answer: Format. This is extremely important and you must do this."},

            # Example user/assistant pairs
            {"role": "user", "content": "Lena woke up to the sound of her phone vibrating on the nightstand, but when she checked, there were no notifications. A soft tapping echoed from her window, rhythmic and deliberate, but the street below was empty. "},
            {"role": "assistant", "content": "Question: What was vibrating on Lena's nightstand? Answer: Her phone."},

            {"role": "user", "content": "Jake hurried through the dark alley, his breath visible in the cold night air. He could hear footsteps behind him, but when he turned around, no one was there."},
            {"role": "assistant", "content": "Question: Where was Jake hurrying through? Answer: A dark alley."},

            {"role": "user", "content": "The old library smelled of dust and forgotten stories. Emily ran her fingers along the worn spines, stopping when she found a book with no title."},
            {"role": "assistant", "content": "Question: What did Emily find? Answer: A book with no title."},

            {"role": "user", "content": "The waves crashed against the rocky shore as Daniel watched the lighthouse flicker in the distance. A storm was coming, and he wasn’t sure if the boat would make it back in time."},
            {"role": "assistant", "content": "Question: What was Daniel watching? Answer: A Lighthouse."},

            {"role": "user", "content": "Ava’s cat sat on the windowsill, staring at something in the dark yard. When she got up to check, there was nothing there but a single muddy footprint."},
            {"role": "assistant", "content": "Question: What was Ava’s cat staring at? Answer: Something in the yard."},

            {"role": "user", "content": "The carnival music played faintly in the background as Leo stepped onto the old Ferris wheel. The ride started moving, but the operator was nowhere to be seen."},
            {"role": "assistant", "content": "Question: Where did Leo step onto? Answer: The Ferris wheel."},

            {"role": "user", "content": "The letter arrived in a faded envelope with no return address. Sarah hesitated before opening it, unsure if she really wanted to know what was inside."},
            {"role": "assistant", "content": "Question: What did Sarah receive? Answer: A letter."},

            {"role": "user", "content": "Ben’s flashlight flickered as he walked deeper into the cave. He swore he heard a whisper, but when he turned, only shadows greeted him."},
            {"role": "assistant", "content": "Question: Where was Ben walking? Answer: Into a cave."},

            {"role": "user", "content": "Olivia placed the key into the rusted lock, her hands trembling. She had waited years for this moment, and now she wasn’t sure if she wanted to know the truth."},
            {"role": "assistant", "content": "Question: What did Olivia place in the lock? Answer: A key."},

            {"role": "user", "content": "The park was empty except for an old swing creaking in the wind. Noah sat on a bench, watching the playground as if waiting for something."},
            {"role": "assistant", "content": "Question: Where was Noah sitting? Answer: On a bench."},

            {"role": "user", "content": "Mia’s clock stopped at exactly midnight, even though the batteries were new. She tapped the glass, but the hands didn’t move."},
            {"role": "assistant", "content": "Question: What time did Mia’s clock stop? Answer: Midnight."},

            {"role": "user", "content": "Ethan stepped into the abandoned house, the floorboards creaking under his weight. A cold breeze brushed past him, even though all the windows were shut."},
            {"role": "assistant", "content": "Question: What creaked under Ethan’s weight? Answer: The floorboards."},

            {"role": "user", "content": "Sophie’s watch alarm beeped twice, signaling the start of her midnight run. The streets were silent, except for the sound of her footsteps echoing on the pavement."},
            {"role": "assistant", "content": "Question: What signaled the start of Sophie’s run? Answer: Her watch alarm."},

            {"role": "user", "content": "Marcus lit a candle as the power went out, casting flickering shadows on the walls. Just as he turned away, he swore he saw one of them move."},
            {"role": "assistant", "content": "Question: What did Marcus use when the power went out? Answer: A candle."}
        ]

    def speech_to_text(self) -> str:
        """
        Use speech_recognition (Google Speech) to recognize audio from the microphone.
        Returns recognized text or 'No Response' on failure.
        """
        r = sr.Recognizer()
        with sr.Microphone() as source:
            print("Talk now...")
            audio_text = r.listen(source)
            try:
                text = r.recognize_google(audio_text)
                print(f"Recognized speech: {text}")
                return text
            except:
                print("No Response recognized.")
                return "No Response"

    def pdf_text_extractor(self, pdf_path: str) -> str:
        
        reader = PdfReader(pdf_path)
        print(f"PDF has {len(reader.pages)} page(s).")
        page = reader.pages[0]
        text = page.extract_text()
        if text:
            return text.replace('\n', ' ').replace('\r', '')
        else:
            return ""

    def question_generator(self, question: str) -> str:
    
        self.message_history.append({"role": "user", "content": question})
        response = openai.chat.completions.create(
        model="gpt-3.5-turbo",
        messages= self.message_history
        )

        reply_content = response.choices[0].message.content

        return reply_content


    def generate_audio(self, text: str):
        """
        Stream TTS audio using ElevenLabs.
        :param text: The text to speak out loud.
        """
        audio_stream = ElevenLabs(api_key=self.elevenlabs_key)
        # The 'voice' argument can be a name or voice ID, depending on your config
        stream(
            audio_stream.generate(
                text=text,
                voice=self.voice,
                stream=True
            )
        )

    def semantic_score(self, correct_answer: str, user_answer: str) -> bool:
       
        emb_correct = self.sentence_model.encode(correct_answer, convert_to_tensor=True)
        emb_user = self.sentence_model.encode(user_answer, convert_to_tensor=True)
        score = util.cos_sim(emb_correct, emb_user).item()
        return score >= 0.50

    def execute(self, story: str):
        """
        Main flow: read the story in segments, TTS them, prompt a question, then handle STT answers.
        :param story: The text to be read/queried.
        """
        words = story.split()
        my_str = ""
        total_words = len(words)

        # For example, break the text into 5 segments
        segment_size = total_words / 5
        next_split = segment_size

        for idx, word in enumerate(words):
            my_str += " " + word

            # Once we've hit the approximate segment boundary and see a period, do the quiz
            if (idx + 1 >= int(next_split)) and ("." in word):
                print(f"[Segment] {my_str.strip()}")
                self.generate_audio(my_str)
                
                # Generate Q&A from segment
                question_and_answer = self.question_generator(my_str)
                # E.g. "Question: What was vibrating on Lena's nightstand? Answer: Her phone."

                # Split question from answer
                # Might need safety checks if format is not guaranteed
                if "Answer:" in question_and_answer:
                    parts = question_and_answer.split("Answer:")
                    question_part = parts[0].strip()
                    answer_part = parts[1].strip()
                else:
                    # Fallback if there's no 'Answer:' substring
                    question_part = question_and_answer
                    answer_part = "Unknown"

                # TTS for the question
                print(f"[Generated Question] {question_part}")
                self.generate_audio(question_part)

                # STT user response
                user_response = self.speech_to_text()
                print(f"[User Response] {user_response}")

                # Compare similarity
                if self.semantic_score(answer_part, user_response):
                    feedback = "Good Job. You answered correctly."
                else:
                    feedback = f"The correct answer was {answer_part}"

                print(f"[Feedback] {feedback}")
                self.generate_audio(feedback)

                # Prepare next segment
                my_str = ""
                next_split += segment_size

