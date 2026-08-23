function copyEmail(){
    const email = document.getElementById('emailText').textContent.trim();
    const feedback = document.getElementById('copyFeedback');
    const showFeedback = () => {
      feedback.classList.add('show');
      setTimeout(() => feedback.classList.remove('show'), 1800);
    };
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(email).then(showFeedback).catch(showFeedback);
    } else {
      const temp = document.createElement('textarea');
      temp.value = email;
      document.body.appendChild(temp);
      temp.select();
      document.execCommand('copy');
      document.body.removeChild(temp);
      showFeedback();
    }
  }
