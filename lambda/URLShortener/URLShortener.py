import boto3
import os
import random
import string
import botocore
from botocore.client import Config

AWS_REGION = os.environ['AWS_REGION']

DEBUG = True

# generate a random string of n characters, lowercase and numbers
def generate_random(n):
  return ''.join(random.SystemRandom().choice(string.ascii_lowercase + string.digits) for _ in range(n))

# checks whether an object already exists in the Amazon S3 bucket
# we do a head_object, if it throws a 404 error then the object does not exist
def exists_s3_key(s3_client, bucket, key):
  try:
    resp = s3_client.head_object(Bucket=bucket, Key=key)
    return True
  except botocore.exceptions.ClientError as e:
    # if ListBucket access is granted, then missing file returns 404
    if (e.response['Error']['Code'] == "404"): return False
    # if ListBucket access is not granted, then missing file returns 403 (which is the case here)
    if (e.response['Error']['Code'] == "403"): return False
    print(e.response)
    raise e     # otherwise re-raise the exception

def handler(event, context):
  print(event)
  BUCKET_NAME = os.environ['S3_BUCKET']   # from env variable

  native_url = event.get("url_long")
  cdn_prefix = event.get("cdn_prefix")

  ### Generate a short id for the redirect
  # check if short_key object already exists - collision could occur
  s3 = boto3.client('s3', config=Config(signature_version='s3v4'))

  while (True):
    short_id = generate_random(7)
    short_key = "u/" + short_id
    if not(exists_s3_key(s3, BUCKET_NAME, short_key)):
      break
    else:
      print("We got a short_key collision: " + short_key + ". Retrying.")

  print("We got a valid short_key: " + short_key)

  ### Third step: create the redirection object in the S3 bucket
  resp = s3.put_object(Bucket=BUCKET_NAME,
                       Key=short_key,
                       Body=b"",
                       WebsiteRedirectLocation=native_url,
                       ContentType="text/plain")

  public_short_url = "http://" + cdn_prefix + "/" + short_id

  return { "url_short": public_short_url, "url_long": native_url }
